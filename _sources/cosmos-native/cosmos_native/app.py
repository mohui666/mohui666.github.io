import json
import os
from pathlib import Path
import signal
import subprocess
import sys
from datetime import datetime
from dataclasses import asdict

import numpy as np
from PySide6 import QtCore, QtGui, QtWidgets as W
import pyqtgraph as pg
import pyqtgraph.opengl as gl

from .ephemeris import ROOT, DATA, AU, DAY, G_SI, Ephemeris
from .orbits import OrbitSystem, OrbitSettings
from .hydro import MaterialBody, ImpactSettings, EARTH_MASS, EARTH_RADIUS, read_snapshot

STYLE = """QWidget { background:#101722; color:#dce5f2; font-size:13px; }
QMainWindow, QSplitter { background:#090f18; }
QTabWidget::pane, QGroupBox { border:1px solid #2c394c; border-radius:6px; }
QGroupBox { margin-top:14px; padding:14px 8px 8px; }
QGroupBox::title { subcontrol-origin:margin; left:12px; color:#91b8db; }
QPushButton { background:#23364b; border:1px solid #3b5570; border-radius:5px; padding:7px; }
QPushButton:hover { background:#35506b; }
QPushButton:disabled { color:#637083; background:#192332; }
QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox, QListWidget, QTextBrowser, QPlainTextEdit {
 background:#0b121d; border:1px solid #2d3a4e; border-radius:4px; padding:5px;
 selection-background-color:#35577c; }
QListWidget::item { padding:5px; } QTabBar::tab { padding:10px 8px; }
QTabBar::tab:selected { color:#88d7ff; background:#23354a; }
QScrollBar:vertical { width:9px; } QStatusBar { color:#8fa5bf; }
"""


def label(text):
    item = W.QLabel(text)
    item.setWordWrap(True)
    return item


def button(text, callback):
    item = W.QPushButton(text)
    item.clicked.connect(callback)
    return item


def number(value, low, high, decimals=4):
    item = W.QDoubleSpinBox()
    item.setDecimals(decimals)
    item.setRange(low, high)
    item.setValue(value)
    item.setKeyboardTracking(False)
    return item


class SpaceView(gl.GLViewWidget):
    def __init__(self):
        super().__init__()
        self.setBackgroundColor("#080e18")
        self.setCameraPosition(distance=4, elevation=30, azimuth=-75)
        self.items_by_body = []
        self.labels = []
        self.name_labels = {}
        self.trails = []
        self.particles = gl.GLScatterPlotItem(pos=np.zeros((0,3)),size=3,pxMode=True)
        self.addItem(self.particles)
        self.grid = gl.GLGridItem()
        self.grid.setSize(5,5)
        self.grid.setSpacing(.5,.5)
        self.grid.setColor((55,78,99,80))
        self.addItem(self.grid)

    def reset_bodies(self, bodies):
        for item in self.name_labels.values():
            item.deleteLater()
        self.name_labels={}
        for group in self.items_by_body:
            for item in group:
                self.removeItem(item)
        self.items_by_body = []
        sphere = gl.MeshData.sphere(rows=18,cols=28)
        for b in bodies:
            color = pg.mkColor(b.color).getRgbF()
            name_label=W.QLabel(b.name,self)
            name_label.setStyleSheet(f"background:transparent; color:{b.color}; font-size:13px;")
            name_label.setAttribute(QtCore.Qt.WidgetAttribute.WA_TransparentForMouseEvents)
            name_label.adjustSize()
            self.name_labels[b.name]=name_label
            mesh = gl.GLMeshItem(meshdata=sphere,smooth=True,color=color,shader="shaded")
            marker = gl.GLLinePlotItem(color=color,width=1.2,antialias=True,mode="lines")
            trail = gl.GLLinePlotItem(color=(*color[:3],.42),width=1,antialias=True)
            self.items_by_body.append((mesh,marker,trail))
            for item in self.items_by_body[-1]:
                self.addItem(item)

    def show_orbits(self, bodies, tracks, follow, show_tracks):
        self.particles.setVisible(False)
        self.grid.setVisible(True)
        origin = np.array(bodies[follow].position)/AU
        marker_size = self.opts["distance"]*.003
        cross = np.array([[-1,0,0],[1,0,0],[0,-1,0],[0,1,0]])*marker_size
        self.labels = []
        for i,(b,group) in enumerate(zip(bodies,self.items_by_body)):
            mesh, marker, trail = group
            pos = np.array(b.position)/AU-origin
            mesh.resetTransform()
            mesh.scale(b.radius/AU,b.radius/AU,b.radius/AU)
            mesh.translate(*pos)
            marker.setData(pos=pos+cross)
            if b.visible:
                self.labels.append((pos,b.name,b.color))
            for item in group:
                item.setVisible(b.visible)
            trail.setVisible(b.visible and show_tracks)
            if len(tracks[i])>1:
                trail.setData(pos=np.array(tracks[i])/AU-origin)

    def paintGL(self):
        super().paintGL()
        viewport=self.getViewport()
        matrix=self.projectionMatrix(viewport,viewport)*self.viewMatrix()
        for item in self.name_labels.values():
            item.hide()
        occupied=[]
        for pos,name,color in self.labels:
            point=matrix.map(QtGui.QVector3D(*[float(v) for v in pos]))
            if not -1<point.z()<1:
                continue
            x=(point.x()+1)*self.width()/2
            y=(1-point.y())*self.height()/2
            if 0<x<self.width() and 0<y<self.height():
                item=self.name_labels[name]
                point=QtCore.QPoint(round(x+8),round(y-22))
                rect=QtCore.QRect(point,item.size())
                while any(rect.intersects(other) for other in occupied):
                    rect.translate(0,18)
                occupied.append(rect)
                item.move(rect.topLeft())
                item.show()

    def show_hydro(self, snapshot, field):
        self.labels=[]
        for group in self.items_by_body:
            for item in group:
                item.setVisible(False)
        self.grid.setVisible(False)
        self.particles.setVisible(True)
        pos = snapshot["pos"]/EARTH_RADIUS
        if field == "材料":
            colors = np.zeros((len(pos),4))
            for mat,color in [(0,"#ffd580"),(400,"#82aabd"),(402,"#ff966c")]:
                colors[snapshot["mat"]==mat] = pg.mkColor(color).getRgbF()
        else:
            values = snapshot["rho"] if field=="密度" else snapshot["u"]
            logs = np.log10(np.maximum(values,1e-30))
            low,high = np.quantile(logs,[.01,.99])
            cmap = pg.colormap.get("CET-L9")
            colors = cmap.map((logs-low)/max(high-low,1e-12),mode="float")
        self.particles.setData(pos=pos,color=colors,size=3,pxMode=True)


class Window(W.QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Cosmos Native · 太阳系与物质碰撞")
        self.resize(1440,940)
        self.system = OrbitSystem.solar()
        self.ephem = Ephemeris()
        self.follow = 0
        self.running = False
        self.mode = "orbit"
        self.dirty = set()
        self.process = None
        self.hydro_files = []
        self.handoff = None
        self.tracks = [[] for b in self.system.bodies]
        self.energy_x, self.energy_y = [], []
        self._setup()
        self.view.reset_bodies(self.system.bodies)
        self.populate_bodies()
        self.refresh()
        self.timer = QtCore.QTimer(self)
        self.timer.timeout.connect(self.tick)
        self.timer.start(40)
        self.job_timer = QtCore.QTimer(self)
        self.job_timer.timeout.connect(self.poll_job)
        self.job_timer.start(500)

    def guarded(self, action):
        try:
            action()
        except Exception as error:
            self.running = False
            self.play.setText("开始积分")
            W.QMessageBox.critical(self,"计算未完成",str(error))

    def _setup(self):
        split = W.QSplitter()
        self.setCentralWidget(split)
        self.tabs = W.QTabWidget()
        self.tabs.setMinimumWidth(370)
        split.addWidget(self.tabs)
        right = W.QWidget()
        layout = W.QVBoxLayout(right)
        layout.setContentsMargins(8,8,8,6)
        self.title = label("太阳系  /  JPL DE440 初值")
        self.title.setStyleSheet("font-size:20px; color:#b8dbef; padding:6px;")
        layout.addWidget(self.title)
        self.caption = label("实际球面与实际半径一致 · 十字为定位标记 · 左键旋转，滚轮缩放，右键平移")
        layout.addWidget(self.caption)
        self.view = SpaceView()
        layout.addWidget(self.view,1)
        bar = W.QHBoxLayout()
        bar.addWidget(button("内太阳系",lambda:self.camera(4,0)))
        bar.addWidget(button("全太阳系",lambda:self.camera(85,0)))
        bar.addWidget(button("聚焦选中天体",self.focus_body))
        bar.addWidget(button("俯视",lambda:self.view.setCameraPosition(elevation=90,azimuth=-90)))
        bar.addWidget(button("保存画面",self.capture))
        layout.addLayout(bar)
        self.replay = W.QSlider(QtCore.Qt.Orientation.Horizontal)
        self.replay.valueChanged.connect(self.show_snapshot)
        self.replay.setEnabled(False)
        layout.addWidget(self.replay)
        self.graph = pg.PlotWidget(background="#0b121c")
        self.graph.setMaximumHeight(145)
        self.graph.showGrid(x=True,y=True,alpha=.15)
        self.graph.setLabel("left","ΔE / |E₀|")
        self.graph.setLabel("bottom","TDB 坐标时间 / 天")
        self.curve = self.graph.plot(pen=pg.mkPen("#77cce8",width=1.8))
        layout.addWidget(self.graph)
        split.addWidget(right)
        split.setSizes([380,1060])
        self._orbit_tab()
        self._hydro_tab()
        self._science_tab()

    def scroll_tab(self, title):
        scroll = W.QScrollArea()
        scroll.setWidgetResizable(True)
        contents = W.QWidget()
        layout = W.QVBoxLayout(contents)
        scroll.setWidget(contents)
        self.tabs.addTab(scroll,title)
        return layout

    def _orbit_tab(self):
        layout = self.scroll_tab("轨道与天体")
        self.utc = W.QLineEdit("2026-09-05T00:00:00")
        layout.addWidget(label("初始时刻 UTC · DE440s 覆盖 1849—2150"))
        layout.addWidget(self.utc)
        layout.addWidget(button("从 JPL 星历重新开始",lambda:self.guarded(self.reset)))
        self.reference_mode = W.QComboBox()
        self.reference_mode.addItems(["自主动力学积分","JPL 星历回放"])
        self.reference_mode.currentIndexChanged.connect(self.change_reference)
        layout.addWidget(self.reference_mode)
        row = W.QHBoxLayout()
        self.play = button("开始积分",self.toggle)
        row.addWidget(self.play)
        row.addWidget(button("单步",lambda:self.guarded(self.step)))
        layout.addLayout(row)
        form = W.QFormLayout()
        self.speed = number(.25,.000001,10,6)
        form.addRow("每帧推进 / 天",self.speed)
        self.epsilon = W.QComboBox()
        self.epsilon.addItems(["1e-10","1e-12","1e-9"])
        form.addRow("IAS15 误差控制",self.epsilon)
        self.gr = W.QCheckBox("全体天体 1PN 相对论项")
        self.gr.setChecked(True)
        self.j2 = W.QCheckBox("太阳与地球 J₂ 引力项")
        self.j2.setChecked(True)
        layout.addLayout(form)
        layout.addWidget(self.gr)
        layout.addWidget(self.j2)
        layout.addWidget(button("应用求解设置",lambda:self.guarded(self.solver_settings)))
        self.track_toggle = W.QCheckBox("显示实际历史轨迹")
        self.track_toggle.setChecked(True)
        layout.addWidget(self.track_toggle)
        self.list = W.QListWidget()
        self.list.setMinimumHeight(210)
        self.list.currentRowChanged.connect(self.select_body)
        self.list.itemChanged.connect(self.visibility)
        self.list.itemDoubleClicked.connect(self.focus_body)
        layout.addWidget(self.list)
        self.body_info = label("")
        layout.addWidget(self.body_info)
        edits = W.QFormLayout()
        self.fields = {}
        for key,text in [("mass","质量 / kg"),("radius","半径 / km"),("j2","J₂"),
            ("x","X / AU"),("y","Y / AU"),("z","Z / AU"),
            ("vx","Vx / km/s"),("vy","Vy / km/s"),("vz","Vz / km/s")]:
            field = W.QLineEdit()
            field.textEdited.connect(lambda _,k=key:self.dirty.add(k))
            self.fields[key] = field
            edits.addRow(text,field)
        layout.addLayout(edits)
        layout.addWidget(button("应用此天体的修改",lambda:self.guarded(self.apply_body)))
        layout.addWidget(button("让此天体向太阳自由坠落",lambda:self.guarded(self.fall)))
        self.contact_info = label("")
        self.contact_info.setStyleSheet("color:#ffc394;")
        layout.addWidget(self.contact_info)
        self.handoff_button = button("将接触状态转入流体实验",self.contact_to_hydro)
        self.handoff_button.setEnabled(False)
        layout.addWidget(self.handoff_button)
        layout.addWidget(button("与同一时刻的 JPL 星历比较",lambda:self.guarded(self.compare)))
        row = W.QHBoxLayout()
        row.addWidget(button("保存场景",self.save))
        row.addWidget(button("加载场景",lambda:self.guarded(self.load)))
        layout.addLayout(row)
        layout.addStretch()

    def _hydro_tab(self):
        layout = self.scroll_tab("物质碰撞")
        layout.addWidget(label("SWIFT REMIX · 三维自引力流体\n冲击波、内能、材料分层、混合与抛射由粒子演化计算。"))
        self.preset = W.QComboBox()
        self.preset.addItems(["原地球与岩质撞击体","太阳质量多方恒星与地球"])
        self.preset.currentIndexChanged.connect(self.hydro_preset)
        layout.addWidget(self.preset)
        self.body_forms = []
        for title, defaults in [("目标",MaterialBody()),("撞击体",MaterialBody(name="撞击体",mass=.133*EARTH_MASS,radius=.566*EARTH_RADIUS,particles=4000))]:
            box = W.QGroupBox(title)
            form = W.QFormLayout(box)
            fields = {}
            for key,text,value in [("mass","质量 / kg",defaults.mass),("radius","半径 / km",defaults.radius/1000),
                ("particles","目标粒子数",defaults.particles),("surface_temperature","表面温度 / K",2000),
                ("spin_hours","自转周期 / h · 0 无自转",0)]:
                field = W.QLineEdit(f"{value:.10g}")
                form.addRow(text,field)
                fields[key]=field
            self.body_forms.append(fields)
            layout.addWidget(box)
        self.hydro_numbers = {}
        form = W.QFormLayout()
        for key,text,val,low,high,precision in [
            ("speed_km_s","接触速度 / km/s",12,.1,2000,3),
            ("angle_degrees","接触角度 / °",30,0,89,2),
            ("duration_s","演化时长 / s",7200,1,1e7,1),
            ("snapshot_s","快照间隔 / s",300,.01,1e6,2),
            ("cfl","CFL 系数",.1,.01,.3,3),
            ("softening_m","引力软化 / m",100000,1,1e8,1),
            ("threads","CPU 线程",8,1,32,0)]:
            item=number(val,low,high,precision)
            self.hydro_numbers[key]=item
            form.addRow(text,item)
        layout.addLayout(form)
        self.hydro_note=label("ANEOS 铁硅核心 + 镁橄榄石地幔；质量、半径给定后求静水平衡核心边界。岩质模型不代表现代地球的完整地球化学结构。")
        layout.addWidget(self.hydro_note)
        self.start_job = button("生成初值并运行流体计算",lambda:self.guarded(self.start_hydro))
        layout.addWidget(self.start_job)
        self.stop_job = button("停止当前计算",self.stop_hydro)
        self.stop_job.setEnabled(False)
        layout.addWidget(self.stop_job)
        layout.addWidget(button("打开已有实验目录",lambda:self.guarded(self.open_hydro)))
        self.color_field=W.QComboBox()
        self.color_field.addItems(["材料","密度","比内能"])
        self.color_field.currentIndexChanged.connect(self.show_snapshot)
        layout.addWidget(self.color_field)
        self.hydro_status=label("粒子分辨率、初态松弛、状态方程和守恒误差需要分别检查。低分辨率计算不能据此预言真实碰撞的碎片数量。")
        layout.addWidget(self.hydro_status)
        self.log=W.QPlainTextEdit()
        self.log.setReadOnly(True)
        self.log.setMaximumBlockCount(150)
        self.log.setMinimumHeight(140)
        layout.addWidget(self.log)

    def _science_tab(self):
        layout=self.scroll_tab("模型与验证")
        self.science=W.QTextBrowser()
        self.science.setOpenExternalLinks(True)
        self.science.setMarkdown((ROOT/"SCIENCE.md").read_text(encoding="utf-8"))
        self.science.setMinimumHeight(700)
        layout.addWidget(self.science)

    def populate_bodies(self):
        self.list.blockSignals(True)
        self.list.clear()
        for b in self.system.bodies:
            item=W.QListWidgetItem(b.name)
            item.setForeground(QtGui.QColor(b.color))
            item.setFlags(item.flags()|QtCore.Qt.ItemFlag.ItemIsUserCheckable)
            item.setCheckState(QtCore.Qt.CheckState.Checked if b.visible else QtCore.Qt.CheckState.Unchecked)
            self.list.addItem(item)
        self.list.blockSignals(False)
        self.list.setCurrentRow(3)

    def select_body(self,index):
        if index<0:
            return
        b=self.system.bodies[index]
        values=dict(mass=b.mass,radius=b.radius/1000,j2=b.j2,
                    **dict(zip(("x","y","z"),np.array(b.position)/AU)),
                    **dict(zip(("vx","vy","vz"),np.array(b.velocity)/1000)))
        for k,v in values.items():
            self.fields[k].setText(f"{v:.16g}")
        self.dirty.clear()
        density=b.mass/(4*np.pi*b.radius**3/3)
        self.body_info.setText(f"{b.name} · 平均密度 {density:,.2f} kg/m³\n只应用手动修改的字段；质量变化不会改变半径。")

    def visibility(self,item):
        self.system.bodies[self.list.row(item)].visible=item.checkState()==QtCore.Qt.CheckState.Checked
        self.refresh()

    def camera(self,distance,follow):
        self.follow=follow
        self.mode="orbit"
        self.view.setCameraPosition(pos=QtGui.QVector3D(0,0,0),distance=distance)
        self.refresh()

    def focus_body(self,*_):
        index=max(self.list.currentRow(),0)
        self.camera(self.system.bodies[index].radius/AU*8,index)

    def refresh(self):
        if self.mode!="orbit":
            return
        self.view.show_orbits(self.system.bodies,self.tracks,self.follow,self.track_toggle.isChecked())
        self.statusBar().showMessage(f"{self.ephem.utc(self.system.epoch+self.system.sim.t*DAY)} UTC  |  t = {self.system.sim.t:.8f} 天  |  {len(self.system.bodies)} 天体")
        if self.system.contact:
            c=self.system.contact
            names=" 与 ".join(self.system.bodies[i].name for i in (c["i"],c["j"]))
            self.contact_info.setText(f"{names}已接触\n相对速度 {c['speed_m_s']/1000:.3f} km/s · 表面距离 {c['surface_gap_m']:.3f} m\n点质量模型在接触处停止；物质演化使用流体实验。")
            self.handoff_button.setEnabled(True)
        else:
            self.contact_info.setText("")
            self.handoff_button.setEnabled(False)

    def tick(self):
        if self.running:
            self.guarded(self.step)

    def toggle(self):
        self.running=not self.running
        self.mode="orbit"
        self.play.setText("暂停" if self.running else "开始积分")

    def step(self):
        self.mode="orbit"
        if self.reference_mode.currentIndex()==1:
            self.system.sim.t+=self.speed.value()
            states=self.ephem.states(self.system.epoch+self.system.sim.t*DAY)
            for b,state in zip(self.system.bodies,states):
                b.position=state[:3].tolist(); b.velocity=state[3:].tolist()
        else:
            self.system.advance(self.speed.value())
        for track,b in zip(self.tracks,self.system.bodies):
            track.append(list(b.position))
            if len(track)>2400:
                del track[0]
        if self.system.contact:
            self.running=False
            self.play.setText("开始积分")
        elif self.reference_mode.currentIndex()==0:
            self.energy_x.append(self.system.sim.t)
            self.energy_y.append((self.system.energy()-self.system.reference_energy)/abs(self.system.reference_energy))
            self.curve.setData(self.energy_x,self.energy_y)
        self.refresh()

    def change_reference(self):
        self.running=False
        self.play.setText("开始积分")
        self.guarded(self.reset)

    def reset(self):
        self.running=False
        self.system=OrbitSystem.solar(self.utc.text(),OrbitSettings(epsilon=float(self.epsilon.currentText()),relativity=self.gr.isChecked(),quadrupoles=self.j2.isChecked()))
        self.tracks=[[] for b in self.system.bodies]
        self.energy_x,self.energy_y=[],[]
        self.curve.setData([],[])
        self.graph.setLabel("bottom","TDB 坐标时间 / 天")
        self.populate_bodies()
        self.play.setText("开始积分")
        self.title.setText("JPL 星历回放 · 观测拟合星历" if self.reference_mode.currentIndex() else "太阳系 · IAS15 动力学实验")
        self.camera(4,0)

    def solver_settings(self):
        self.running=False
        self.play.setText("开始积分")
        self.system.sync()
        self.system.settings=OrbitSettings(epsilon=float(self.epsilon.currentText()),relativity=self.gr.isChecked(),quadrupoles=self.j2.isChecked())
        self.system._build(self.system.sim.t)
        self.system.reference_energy=self.system.energy()
        self.energy_x,self.energy_y=[],[]

    def apply_body(self):
        if self.reference_mode.currentIndex():
            raise ValueError("星历回放不可修改天体；请切换自主动力学积分")
        self.running=False
        self.play.setText("开始积分")
        i=self.list.currentRow()
        changes={}
        for key in self.dirty:
            value=float(self.fields[key].text())
            if not np.isfinite(value):
                raise ValueError("参数必须为有限数值")
            if key in ("mass","radius") and value<=0:
                raise ValueError("质量与半径必须为正数")
            if key in ("x","y","z"):
                changes.setdefault("position",list(self.system.bodies[i].position))[("x","y","z").index(key)]=value*AU
            elif key in ("vx","vy","vz"):
                changes.setdefault("velocity",list(self.system.bodies[i].velocity))[("vx","vy","vz").index(key)]=value*1000
            else:
                changes[key]=value*1000 if key=="radius" else value
        self.system.edit(i,changes)
        self.select_body(i)
        self.tracks=[[] for b in self.system.bodies]
        self.energy_x,self.energy_y=[],[]
        self.refresh()

    def fall(self):
        if self.reference_mode.currentIndex():
            raise ValueError("请切换自主动力学积分")
        i=self.list.currentRow()
        self.system.fall_to_sun(i)
        self.select_body(i)
        self.speed.setValue(1)
        self.tracks=[[] for b in self.system.bodies]
        self.energy_x,self.energy_y=[],[]
        self.camera(2.8,0)
        self.running=True
        self.play.setText("暂停")

    def compare(self):
        if self.system.modified:
            raise ValueError("场景已被修改，与未受修改的真实太阳系不再是同一物理问题")
        errors=self.system.ephemeris_errors()
        W.QMessageBox.information(self,"日心位置偏差 · km","\n".join(f"{b.name}：{e:.6f} km" for b,e in zip(self.system.bodies,errors))+"\n\n这是模型与星历的差异，不能等同于积分误差。")

    def save(self):
        if self.reference_mode.currentIndex():
            W.QMessageBox.information(self,"星历回放","请在动力学模式中保存可编辑场景。")
            return
        path,_=W.QFileDialog.getSaveFileName(self,"保存场景",str(ROOT/"runs/scene.json"),"JSON (*.json)")
        if path:
            self.guarded(lambda:self.system.save(path))

    def load(self):
        path,_=W.QFileDialog.getOpenFileName(self,"加载场景",str(ROOT/"runs"),"JSON (*.json)")
        if path:
            self.running=False
            self.reference_mode.blockSignals(True);self.reference_mode.setCurrentIndex(0);self.reference_mode.blockSignals(False)
            self.system=OrbitSystem.load(path)
            self.gr.setChecked(self.system.settings.relativity);self.j2.setChecked(self.system.settings.quadrupoles)
            self.view.reset_bodies(self.system.bodies)
            self.tracks=[[] for b in self.system.bodies]
            self.populate_bodies();self.camera(4,0)

    def capture(self):
        path,_=W.QFileDialog.getSaveFileName(self,"保存画面",str(ROOT/"runs/cosmos.png"),"PNG (*.png)")
        if path:
            self.grab().save(path)

    def hydro_preset(self):
        self.handoff=None
        for key in ("speed_km_s","angle_degrees"):
            self.hydro_numbers[key].setEnabled(True)
        star=self.preset.currentIndex()==1
        a=MaterialBody(name="多方恒星",mass=1.988409870698051e30,radius=695700e3,particles=50000,material="star") if star else MaterialBody()
        b=MaterialBody(name="地球",particles=8000) if star else MaterialBody(name="撞击体",mass=.133*EARTH_MASS,radius=.566*EARTH_RADIUS,particles=4000)
        for fields,body in zip(self.body_forms,[a,b]):
            for key,field in fields.items():
                field.setText(f"{getattr(body,key)/(1000 if key=='radius' else 1):.10g}")
        self.hydro_numbers["speed_km_s"].setValue(617 if star else 12)
        self.hydro_numbers["angle_degrees"].setValue(0 if star else 30)
        self.hydro_note.setText("恒星采用 n=3 多方结构与 γ=5/3 理想气体；不含核反应、辐射输运或真实太阳结构。该粒子数不能解析完整地球—太阳破坏，请用分辨率对照判断可解析尺度。" if star else "ANEOS 铁硅核心 + 镁橄榄石地幔；固定质量与半径求球形静水平衡，不是现代地球的完整内部模型。")

    def contact_to_hydro(self):
        c=self.system.contact
        if not c:
            return
        a,b=[self.system.bodies[i] for i in (c["i"],c["j"])]
        if a.mass<b.mass:
            a,b=b,a
        self.preset.setCurrentIndex(1 if a.key=="sun" else 0)
        self.hydro_preset()
        for fields,body in zip(self.body_forms,[a,b]):
            fields["mass"].setText(f"{body.mass:.16g}")
            fields["radius"].setText(f"{body.radius/1000:.16g}")
        self.handoff={"relative_position_m":(np.array(b.position)-a.position).tolist(),
                      "relative_velocity_m_s":(np.array(b.velocity)-a.velocity).tolist(),
                      "source_epoch_tdb_s":self.system.epoch+self.system.sim.t*DAY}
        self.hydro_numbers["speed_km_s"].setValue(c["speed_m_s"]/1000)
        for key in ("speed_km_s","angle_degrees"):
            self.hydro_numbers[key].setEnabled(False)
        self.hydro_note.setText(self.hydro_note.text()+"\n将使用已捕获的三维接触位置与速度；本地流体实验不含其他太阳系天体的外场。")
        self.tabs.setCurrentIndex(1)

    def start_hydro(self):
        self.running=False
        self.play.setText("开始积分")
        star=self.preset.currentIndex()==1
        bodies=[]
        for index,fields in enumerate(self.body_forms):
            values={key:float(field.text()) for key,field in fields.items()}
            values["radius"]*=1000
            values["particles"]=int(values["particles"])
            if not all(np.isfinite(v) for v in values.values()) or min(values["mass"],values["radius"])<=0 or values["particles"]<512:
                raise ValueError("质量、半径需为正数；每颗天体至少 512 个粒子")
            values["material"]="star" if star and index==0 else "rock"
            values["name"]="目标" if index==0 else "撞击体"
            bodies.append(values)
        settings={k:v.value() for k,v in self.hydro_numbers.items()}
        settings["threads"]=int(settings["threads"])
        settings=asdict(ImpactSettings(**settings))
        stamp=datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        self.job_dir=ROOT/"runs"/f"impact-{stamp}"
        spec={"directory":str(self.job_dir),"target":bodies[0],"impactor":bodies[1],"settings":settings,"encounter":self.handoff}
        spec_path=ROOT/"runs"/f"impact-{stamp}.json"
        spec_path.write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding="utf-8")
        self.job_log=ROOT/"runs"/f"impact-{stamp}.log"
        with self.job_log.open("w",encoding="utf-8") as log:
            self.process=subprocess.Popen([sys.executable,"-u","-m","cosmos_native","impact","--spec",str(spec_path)],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        self.start_job.setEnabled(False)
        self.stop_job.setEnabled(True)
        self.hydro_status.setText("正在生成初态并计算。完成后可拖动时间轴回放；原始数据保存在实验目录。")

    def stop_hydro(self):
        if self.process and self.process.poll() is None:
            os.killpg(self.process.pid,signal.SIGTERM)

    def poll_job(self):
        if not self.process:
            return
        content=self.job_log.read_text(encoding="utf-8",errors="replace")
        self.log.setPlainText("\n".join(content.splitlines()[-40:]))
        self.log.verticalScrollBar().setValue(self.log.verticalScrollBar().maximum())
        code=self.process.poll()
        if code is not None:
            self.process=None
            self.start_job.setEnabled(True);self.stop_job.setEnabled(False)
            if code==0:
                self.guarded(lambda:self.load_hydro(self.job_dir))
            else:
                self.hydro_status.setText(f"计算已停止，退出码 {code}。日志保留了具体原因；该实验未完成。")

    def open_hydro(self):
        directory=W.QFileDialog.getExistingDirectory(self,"打开流体实验",str(ROOT/"runs"))
        if directory:
            self.load_hydro(Path(directory))

    def load_hydro(self,directory):
        experiment=json.loads((directory/"experiment.json").read_text(encoding="utf-8"))
        self.preset.setCurrentIndex(1 if experiment["target"]["material"]=="star" else 0)
        self.hydro_preset()
        for fields,body in zip(self.body_forms,[experiment["target"],experiment["impactor"]]):
            for key,field in fields.items():
                field.setText(f"{body[key]/(1000 if key=='radius' else 1):.16g}")
        for key,item in self.hydro_numbers.items():
            item.setValue(experiment["settings"][key])
        self.handoff=experiment["encounter"]
        if self.handoff:
            for key in ("speed_km_s","angle_degrees"):
                self.hydro_numbers[key].setEnabled(False)
        self.hydro_files=sorted((directory/"snapshots").glob("impact_*.hdf5"))
        if not self.hydro_files:
            raise ValueError("此目录没有已完成的流体快照")
        self.running=False
        self.play.setText("开始积分")
        self.mode="hydro"
        self.replay.setEnabled(True)
        self.replay.setRange(0,len(self.hydro_files)-1)
        first=read_snapshot(self.hydro_files[0])
        self.view.setCameraPosition(pos=QtGui.QVector3D(0,0,0),distance=np.max(np.linalg.norm(first["pos"],axis=1))/EARTH_RADIUS*3)
        self.title.setText(f"{experiment['target']['name']} × {experiment['impactor']['name']} · SWIFT REMIX")
        self.caption.setText("物质粒子回放 · 长度单位：地球半径 · 镁橄榄石：蓝灰 / 铁硅：橙 / 理想气体：金色")
        self.replay.setValue(len(self.hydro_files)-1)
        self.show_snapshot()
        statistics=np.loadtxt(directory/"statistics.txt")
        self.graph.setLabel("bottom","流体时间 / s")
        energy=statistics[:,13:16].sum(axis=1)
        self.curve.setData(statistics[:,1],(energy-energy[0])/abs(energy[0]))
        self.hydro_status.setText(f"已载入 {len(self.hydro_files)} 帧。{directory.name}\n分辨率尚未标记为收敛；请结合守恒曲线与模型说明评估结果。")

    def show_snapshot(self,*_):
        if not self.hydro_files or self.mode!="hydro":
            return
        snapshot=read_snapshot(self.hydro_files[self.replay.value()])
        self.view.show_hydro(snapshot,self.color_field.currentText())
        self.statusBar().showMessage(f"流体时间 {snapshot['time']:.2f} s  |  {len(snapshot['mass']):,} 个物质粒子  |  总质量 {snapshot['mass'].sum():.8e} kg  |  ρ 与内能来自求解输出")

    def closeEvent(self,event):
        # Closing the UI intentionally leaves an already launched batch job
        # running; its data and log paths remain under runs/.
        event.accept()


def launch():
    app=W.QApplication(sys.argv)
    font=DATA/"NotoSansCJKsc-Regular.otf"
    if font.exists():
        QtGui.QFontDatabase.addApplicationFont(str(font))
    app.setFont(QtGui.QFont("Noto Sans CJK SC",10))
    app.setStyleSheet(STYLE)
    window=Window()
    window.show()
    sys.exit(app.exec())
