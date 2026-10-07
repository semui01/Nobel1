import soundfile as sf, json, sys
from kokoro_onnx import Kokoro
k = Kokoro("voices/kokoro-v1.0.onnx", "voices/voices-v1.0.bin")
lines = [
"The South Pole station has a genius method for making sewage disappear.",
"With no ocean, flying millions of gallons of wastewater out is physically impossible.",
"So, follow a single toilet flush, deep beneath the ice.",
"It starts with drinking water.",
"Engineers pump heated water underground, melting out a massive pool of fresh water, called a Rodriguez well.",
"Over time, pumping out this water makes the cavity deeper, and wider.",
"Eventually, it requires too much fuel to prevent freezing.",
"So they abandon it. But they immediately repurpose this exhausted drinking water cavity.",
"All the station's raw sewage is ground into a slurry, and rerouted straight down, into the empty ice void.",
"This massive thermal load is incredibly dangerous.",
"If the warm sewage melts upward through the porous snow, it can completely collapse the multi-million dollar buildings above.",
"But the minus fifty degree ice eventually neutralizes the threat.",
"Once the bulb fills up, the entire cavity freezes solid.",
"So, what actually happens to that single toilet flush we tracked from the beginning?",
"It is permanently locked inside an impenetrable frozen tomb, slowly creeping toward the coast.",
]
speed=float(sys.argv[1]); voice=sys.argv[2]
out=[]
for i,l in enumerate(lines):
    s,sr=k.create(l,voice=voice,speed=speed,lang="en-us")
    sf.write(f"vo/{i:02d}.wav",s,sr); out.append(len(s)/sr)
json.dump(out,open("vo/durs.json","w")); print(sum(out), [round(x,2) for x in out])
