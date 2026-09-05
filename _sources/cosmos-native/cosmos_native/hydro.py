"""Resolved multi-material impacts: WoMa initial data and native SWIFT REMIX."""
from dataclasses import dataclass, asdict
from pathlib import Path
import json
import subprocess

import h5py
import numpy as np
from scipy.integrate import solve_ivp
import yaml

from .ephemeris import ROOT, DATA, G_SI, C

EARTH_MASS = 5.9724e24
EARTH_RADIUS = 6.371e6


@dataclass
class MaterialBody:
    name: str = "原地球"
    mass: float = EARTH_MASS
    radius: float = EARTH_RADIUS
    particles: int = 20000
    material: str = "rock"
    surface_temperature: float = 2000.0
    spin_hours: float = 0.0
    polytropic_index: float = 3.0


@dataclass
class ImpactSettings:
    speed_km_s: float = 12.0
    angle_degrees: float = 30.0
    duration_s: float = 7200.0
    snapshot_s: float = 300.0
    cfl: float = 0.1
    gravity_tolerance: float = 1e-4
    softening_m: float = 100000.0
    threads: int = 8
    separation_factor: float = 1.15


def lane_emden(n, mass, radius, samples=2000):
    """Hydrostatic polytrope, P=K rho^(1+1/n); gamma of the gas is 5/3."""
    def rhs(x, y):
        return [y[1], -2*y[1]/x - max(y[0], 0)**n]

    def surface(x, y):
        return y[0]
    surface.terminal = True
    surface.direction = -1
    x0 = 1e-7
    solution = solve_ivp(rhs, (x0, 40), [1-x0*x0/6, -x0/3],
                         events=surface, dense_output=True, rtol=1e-10, atol=1e-12,
                         max_step=.02)
    x1 = solution.t_events[0][0]
    derivative = solution.y_events[0][0][1]
    a = radius/x1
    rho_c = mass/(4*np.pi*a**3 * -x1*x1*derivative)
    K = 4*np.pi*G_SI*a*a/(n+1)*rho_c**(1-1/n)
    # Exclude the mathematical vacuum surface; it has no particle mass.
    x = np.linspace(x0, x1*(1-1e-6), samples)
    theta = solution.sol(x)[0]
    rho = rho_c*theta**n
    pressure = K*rho**(1+1/n)
    u = pressure/((5/3-1)*rho)
    return x*a, rho, pressure, u, x1


def particles_for(body, destination, seed):
    import woma
    import seagen
    if body.material == "rock":
        woma.misc.glob_vars.Fp_ANEOS_forsterite = str(DATA/"ANEOS_forsterite_S19.txt")
        woma.misc.glob_vars.Fp_ANEOS_Fe85Si15 = str(DATA/"ANEOS_Fe85Si15_S20.txt")
        materials = ["ANEOS_Fe85Si15", "ANEOS_forsterite"]
        woma.load_eos_tables(materials)
        planet = woma.Planet(name=body.name, A1_mat_layer=materials,
            A1_T_rho_type=["adiabatic", "adiabatic"], M=body.mass, R=body.radius,
            P_s=1e5, T_s=body.surface_temperature, num_prof=2000)
        planet.gen_prof_L2_find_R1_given_M_R(tol=1e-5, verbosity=0)
        planet.save(str(destination), verbosity=0)
        p = woma.ParticlePlanet(planet, body.particles, N_ngb=100, seed=seed, verbosity=0)
        result = dict(pos=p.A2_pos, vel=p.A2_vel, m=p.A1_m, h=p.A1_h,
                      rho=p.A1_rho, P=p.A1_P, u=p.A1_u, mat=p.A1_mat_id)
        profile = {"core_mass_fraction": float(planet.A1_M_layer[0]/planet.M),
                   "profile_mass_kg": float(planet.M), "radius_m": float(planet.R)}
    else:
        r, rho, pressure, u, x1 = lane_emden(body.polytropic_index, body.mass, body.radius)
        p = seagen.GenSphere(body.particles, r, rho, A1_mat_prof=np.zeros_like(r),
                            A1_u_prof=u, A1_P_prof=pressure, verbosity=0, seed=seed)
        pos = np.column_stack([p.A1_x, p.A1_y, p.A1_z])
        result = dict(pos=pos, vel=np.zeros_like(pos), m=p.A1_m, rho=p.A1_rho,
                      P=p.A1_P, u=p.A1_u, mat=np.zeros(len(pos), dtype=np.int32))
        # WoMa convention: approximate support contains 100 neighbours.
        result["h"] = .5*(3*100*result["m"]/(4*np.pi*result["rho"]))**(1/3)
        profile = {"polytropic_index": body.polytropic_index,
                   "lane_emden_surface": float(x1), "profile_mass_kg": body.mass,
                   "radius_m": body.radius}
        with h5py.File(destination, "w") as f:
            for name, values in zip(("radius_m", "density_kg_m3", "pressure_pa", "u_j_kg"), (r,rho,pressure,u)):
                f[name] = values
    # Discretisation must not change the requested mass or radius. The tiny mass
    # normalisation and initial-profile residual remain visible in the manifest.
    scale = body.mass / result["m"].sum()
    result["m"] *= scale
    result["rho"] *= scale
    if body.material == "rock":
        result["P"] = woma.A1_P_u_rho(result["u"], result["rho"], result["mat"])
    else:
        result["P"] = (5/3-1)*result["rho"]*result["u"]
    result["pos"] -= np.average(result["pos"], axis=0, weights=result["m"])
    if body.spin_hours:
        omega = np.array([0,0,2*np.pi/(body.spin_hours*3600)])
        result["vel"] += np.cross(omega, result["pos"])
    profile.update(actual_particles=len(result["m"]), mass_normalisation=float(scale))
    return result, profile


def swift_parameters(ic, settings, boxsize, material_bodies):
    eos = {}
    if any(b.material == "rock" for b in material_bodies):
        eos.update(planetary_use_ANEOS_forsterite=1, planetary_use_ANEOS_Fe85Si15=1,
            planetary_ANEOS_forsterite_table_file=str(DATA/"ANEOS_forsterite_S19.txt"),
            planetary_ANEOS_Fe85Si15_table_file=str(DATA/"ANEOS_Fe85Si15_S20.txt"))
    if any(b.material == "star" for b in material_bodies):
        eos["planetary_use_idg_def"] = 1
    return {
        "InternalUnitSystem": {"UnitMass_in_cgs":1e27, "UnitLength_in_cgs":1e8,
            "UnitVelocity_in_cgs":1e8, "UnitCurrent_in_cgs":1, "UnitTemp_in_cgs":1},
        "InitialConditions": {"file_name":str(ic), "periodic":0},
        "TimeIntegration": {"time_begin":0, "time_end":settings.duration_s, "dt_min":1e-9, "dt_max":100},
        "Snapshots": {"subdir":"snapshots", "basename":"impact", "time_first":0, "delta_time":settings.snapshot_s},
        "Statistics": {"time_first":0, "delta_time":settings.snapshot_s/5},
        "Restarts": {"enable":0},
        "SPH": {"resolution_eta":1.487, "delta_neighbours":.1, "CFL_condition":settings.cfl,
                "h_max":boxsize/1e6/8},
        "Gravity": {"eta":.01, "MAC":"adaptive", "epsilon_fmm":settings.gravity_tolerance,
                    "theta_cr":.5, "max_physical_baryon_softening":settings.softening_m/1e6},
        "Scheduler": {"max_top_level_cells":32},
        "EoS":eos,
    }


def prepare_impact(directory, target, impactor, settings, encounter=None):
    import woma
    if max(G_SI*b.mass/(b.radius*C*C) for b in (target,impactor))>=.01:
        raise ValueError("当前流体求解器为牛顿弱场模型，不能模拟这种致密度的天体")
    speed = settings.speed_km_s*1000 if encounter is None else np.linalg.norm(encounter["relative_velocity_m_s"])
    if speed>=.1*C:
        raise ValueError("当前流体求解器不适用于相对论速度")
    if settings.snapshot_s>settings.duration_s:
        raise ValueError("快照间隔不能大于演化时长")
    directory = Path(directory).resolve()
    directory.mkdir(parents=True, exist_ok=False)
    print("建立目标天体的静水平衡与材料分层…", flush=True)
    a, a_profile = particles_for(target, directory/"target_profile.hdf5", 1731)
    print("建立撞击体的静水平衡与材料分层…", flush=True)
    b, b_profile = particles_for(impactor, directory/"impactor_profile.hdf5", 2873)
    if encounter is None:
        # User's speed and angle refer to first contact, not the starting gap.
        pos, vel = woma.impact_pos_vel_b_v_c_r(
            b=np.sin(np.radians(settings.angle_degrees)), v_c=settings.speed_km_s*1000,
            units_v_c="m/s", r=(target.radius+impactor.radius)*settings.separation_factor,
            R_t=target.radius, R_i=impactor.radius, M_t=target.mass, M_i=impactor.mass)
    else:
        # Explicit handoff uses the measured 3D encounter state, not a canned hit.
        pos = np.array(encounter["relative_position_m"])
        vel = np.array(encounter["relative_velocity_m_s"])
    total_mass = target.mass+impactor.mass
    a["pos"] -= pos*impactor.mass/total_mass
    b["pos"] += pos*target.mass/total_mass
    a["vel"] -= vel*impactor.mass/total_mass
    b["vel"] += vel*target.mass/total_mass
    arrays = {k:np.concatenate([a[k], b[k]]) for k in a}
    # An open gravitational problem still needs a finite particle storage box.
    # Include ballistic travel over the requested interval; no particles are culled.
    box = float(4*(np.linalg.norm(pos)+target.radius+impactor.radius+
                  np.linalg.norm(vel)*settings.duration_s))
    ids = np.arange(1,len(arrays["m"])+1,dtype=np.uint64)
    with h5py.File(directory/"initial.hdf5", "w") as f:
        woma.save_particle_data(f, A2_pos=arrays["pos"], A2_vel=arrays["vel"],
            A1_m=arrays["m"], A1_h=arrays["h"], A1_rho=arrays["rho"], A1_P=arrays["P"],
            A1_u=arrays["u"], A1_mat_id=arrays["mat"], A1_id=ids,
            boxsize=box, file_to_SI=woma.Conversions(m=1e24,l=1e6,t=1), verbosity=0)
    parameters = swift_parameters(directory/"initial.hdf5",settings,box,[target,impactor])
    (directory/"impact.yml").write_text(yaml.safe_dump(parameters,sort_keys=False), encoding="utf-8")
    manifest = {"target":asdict(target), "impactor":asdict(impactor), "settings":asdict(settings),
                "target_profile":a_profile, "impactor_profile":b_profile,
                "target_last_particle_id":len(a["m"]), "encounter":encounter,
                "solver":"SWIFT 2026.04 / REMIX / Wendland C2 / Newtonian self-gravity",
                "model_status":"未证明分辨率收敛；球形静水平衡初态，尚未经过独立松弛校验"}
    (directory/"experiment.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"初值完成：{len(arrays['m']):,} 个物质粒子；质量守恒，实际半径独立。",flush=True)
    return directory


def run_swift(directory, threads=8):
    directory = Path(directory).resolve()
    result = subprocess.run([str(ROOT/"vendor/swift/swift"), "--hydro", "--self-gravity",
                             "--threads",str(threads), "impact.yml"], cwd=directory)
    result.check_returncode()


def read_snapshot(path):
    with h5py.File(path,"r") as f:
        units = f["Units"].attrs
        length = np.asarray(units["Unit length in cgs (U_L)"]).item()*.01
        mass = np.asarray(units["Unit mass in cgs (U_M)"]).item()*.001
        time = np.asarray(units["Unit time in cgs (U_t)"]).item()
        p = f["PartType0"]
        return {"pos":(p["Coordinates"][:]-np.asarray(f["Header"].attrs["BoxSize"])/2)*length,
                "vel":p["Velocities"][:]*length/time, "mass":p["Masses"][:]*mass,
                "rho":p["Densities"][:]*mass/length**3,
                "u":p["InternalEnergies"][:]*(length/time)**2,
                "mat":p["MaterialIDs"][:], "ids":p["ParticleIDs"][:],
                "time":float(np.asarray(f["Header"].attrs["Time"]).flat[0])*time}
