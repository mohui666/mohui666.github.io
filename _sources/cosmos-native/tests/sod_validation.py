"""3D REMIX Sod shock against SWIFT's independent exact Euler Riemann solver."""
import json
from pathlib import Path
import subprocess
import sys

import h5py
import numpy as np
from scipy.stats import binned_statistic
import yaml

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cosmos_native.ephemeris import ROOT
sys.path.insert(0,str(ROOT/"vendor/swift/examples/HydroTests"))
from riemannSolver import RiemannSolver


def run(nx):
    directory=ROOT/"runs"/f"sod-{nx}"
    directory.mkdir(exist_ok=True)
    arrays=[]
    for dx, offset, density, pressure in [(1/nx,0,1.,1.),(2/nx,1,.125,.1)]:
        axes=[(np.arange(round(length/dx))+.5)*dx for length in (1,1,1)]
        pos=np.stack(np.meshgrid(*axes,indexing="ij"),axis=-1).reshape(-1,3)
        pos[:,0]+=offset
        count=len(pos)
        arrays.append((pos,np.full(count,density),np.full(count,pressure/(density*(5/3-1))),np.full(count,dx)))
    pos,rho,u,dx=[np.concatenate(parts) for parts in zip(*arrays)]
    count=len(pos)
    with h5py.File(directory/"initial.hdf5","w") as f:
        h=f.create_group("Header").attrs
        h.update(BoxSize=[2.,1.,1.],NumPart_Total=[count,0,0,0,0,0],NumPart_Total_HighWord=[0]*6,
                 NumPart_ThisFile=[count,0,0,0,0,0],Time=0.,NumFilesPerSnapshot=1,
                 MassTable=[0.]*6,Flag_Entropy_ICs=0,Dimension=3)
        units=f.create_group("Units").attrs
        for key in ["Unit length in cgs (U_L)","Unit mass in cgs (U_M)","Unit time in cgs (U_t)",
                    "Unit current in cgs (U_I)","Unit temperature in cgs (U_T)"]:
            units[key]=1.
        p=f.create_group("PartType0")
        for key,data in dict(Coordinates=pos,Velocities=np.zeros_like(pos),Masses=rho*dx**3,
            Density=rho,SmoothingLength=1.487*dx,InternalEnergy=u,
            ParticleIDs=np.arange(1,count+1,dtype=np.uint64),MaterialIDs=np.zeros(count,dtype=np.int32)).items():
            p[key]=data
    parameters={
        "InternalUnitSystem":dict(UnitMass_in_cgs=1,UnitLength_in_cgs=1,UnitVelocity_in_cgs=1,UnitCurrent_in_cgs=1,UnitTemp_in_cgs=1),
        "InitialConditions":dict(file_name="initial.hdf5",periodic=1),
        "TimeIntegration":dict(time_begin=0,time_end=.2,dt_min=1e-10,dt_max=.005),
        "Snapshots":dict(basename="sod",time_first=0,delta_time=.2),
        "Statistics":dict(delta_time=.01),"Restarts":dict(enable=0),
        "SPH":dict(resolution_eta=1.487,delta_neighbours=.1,CFL_condition=.1),
        "EoS":dict(planetary_use_idg_def=1)}
    (directory/"sod.yml").write_text(yaml.safe_dump(parameters),encoding="utf-8")
    with (directory/"solver.log").open("w") as log:
        subprocess.run([str(ROOT/"vendor/swift/swift"),"--hydro","--threads","4","sod.yml"],cwd=directory,stdout=log,stderr=subprocess.STDOUT,check=True)
    with h5py.File(directory/"sod_0001.hdf5","r") as f:
        x=f["PartType0/Coordinates"][:,0]-1
        density=f["PartType0/Densities"][:]
        masses=f["PartType0/Masses"][:]
    edges=np.linspace(-.55,.55,12)
    centers=(edges[1:]+edges[:-1])/2
    exact=RiemannSolver(5/3).solve(1.,0.,1.,.125,0.,.1,centers/.2)[0]
    actual=binned_statistic(x,density,statistic="mean",bins=edges).statistic
    assert np.isfinite(actual).all()
    use=abs(x)<.55
    particle_exact=RiemannSolver(5/3).solve(1.,0.,1.,.125,0.,.1,x[use]/.2)[0]
    error=np.average(abs(density[use]-particle_exact),weights=masses[use]/density[use])
    statistics=np.loadtxt(directory/"statistics.txt")
    energy=statistics[:,13:16].sum(axis=1)
    result=dict(nx=nx,particles=count,density_L1=float(error),max_energy_change=float(np.max(abs(energy-energy[0]))/abs(energy[0])))
    np.savez(directory/"density_comparison.npz",x=centers,exact=exact,actual=actual)
    print(json.dumps(result),flush=True)
    return result


if __name__=="__main__":
    results=[run(n) for n in (32,48)]
    assert results[1]["density_L1"]<results[0]["density_L1"]
    assert results[1]["density_L1"]<.06
    (ROOT/"runs/sod-validation.json").write_text(json.dumps(results,indent=2))
