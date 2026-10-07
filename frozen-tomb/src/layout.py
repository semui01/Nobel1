import soundfile as sf, numpy as np, json
TOTAL=74.0
clips=[]
for i in range(15):
    s,sr=sf.read(f"vo/{i:02d}.wav")
    a=np.abs(s); thr=0.01
    idx=np.where(a>thr)[0]; s=s[max(0,idx[0]-int(.03*sr)):idx[-1]+int(.08*sr)]
    clips.append(s)
durs=[len(c)/sr for c in clips]
# relative pause weights after each line (bigger = scene break)
w=[1.2,1.3,1.6,0.8,1.2,1.0,1.0,1.4,1.4,0.8,1.4,1.0,1.6,1.3,0]
start=0.7; tail=2.6
free=TOTAL-start-tail-sum(durs)
unit=free/sum(w); print("free",free,"unit",unit)
t=start; starts=[]
for d,ww in zip(durs,w):
    starts.append(t); t+=d+ww*unit
out=np.zeros(int(TOTAL*sr))
for s0,c in zip(starts,clips):
    i=int(s0*sr); out[i:i+len(c)]+=c
sf.write("vo_full.wav",out,sr)
json.dump([{"s":round(a,3),"e":round(a+d,3)} for a,d in zip(starts,durs)],open("timeline.json","w"))
print(json.load(open("timeline.json")))
