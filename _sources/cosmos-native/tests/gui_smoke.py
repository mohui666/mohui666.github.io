import os
os.environ["QT_QPA_PLATFORM"]="xcb"
os.environ["QT_XCB_GL_INTEGRATION"]="xcb_glx"
os.environ["PYOPENGL_PLATFORM"]="glx"
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from PySide6 import QtCore,QtGui,QtWidgets,QtTest
from cosmos_native.app import Window,STYLE,DATA,ROOT
from cosmos_native.orbits import OrbitSystem

app=QtWidgets.QApplication([])
QtGui.QFontDatabase.addApplicationFont(str(DATA/"NotoSansCJKsc-Regular.otf"))
app.setFont(QtGui.QFont("Noto Sans CJK SC",10))
app.setStyleSheet(STYLE)
window=Window()
window.show()
QtTest.QTest.qWait(800)
window.grab().save(str(ROOT/"runs/native-orbits.png"))
window.list.setCurrentRow(3)
radius=window.system.bodies[3].radius
field=window.fields["mass"]
field.setFocus();field.selectAll();QtTest.QTest.keyClicks(field,"6e25")
window.apply_body()
assert window.system.bodies[3].mass==6e25
assert window.system.bodies[3].radius==radius
window.focus_body()
QtTest.QTest.qWait(250)
window.grab().save(str(ROOT/"runs/native-earth.png"))
window.list.item(3).setCheckState(QtCore.Qt.CheckState.Unchecked)
assert not window.system.bodies[3].visible
window.list.item(3).setCheckState(QtCore.Qt.CheckState.Checked)
window.reset()
window.system.edit(3,{"position":list(window.system.bodies[0].position)})
window.refresh()
assert window.system.contact and window.handoff_button.isEnabled()
window.contact_to_hydro()
assert window.handoff is not None
assert float(window.body_forms[1]["radius"].text())*1000==radius
window.load_hydro(ROOT/"runs/impact-4096-v2")
window.tabs.setCurrentIndex(1)
QtTest.QTest.qWait(600)
window.grab().save(str(ROOT/"runs/native-collision.png"))
window.replay.setValue(0)
window.color_field.setCurrentIndex(1)
QtTest.QTest.qWait(200)
assert window.mode=="hydro" and window.replay.maximum()==12
window.close()
print("PASS: native window, Chinese font, independent radius, body visibility, contact handoff, HDF5 replay and density view",flush=True)
