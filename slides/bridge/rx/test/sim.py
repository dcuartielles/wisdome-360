"""Offline test of the buffer + clock controller: a sender and a Dante clock that disagree by some
ppm, network jitter and occasional stalls, 10 virtual minutes each. Runs in ~1 min, no hardware.
    python3 test/sim.py
"""
import sys, math, numpy as np
import os; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import domebridge_rx as rx

def run(sender_ppm, sink_ppm, secs=600, jitter_ms=2, seed=1, stall_p=0.0002, stall_ms=(50, 50)):
    rng = np.random.default_rng(seed)
    st = rx.Stream(6, 48000, TARGET, 300)
    rs = 48000*(1+sender_ppm*1e-6); rc = 48000*(1+sink_ppm*1e-6)
    blk_in, blk_out = 480, 240
    t_send = 0.0; t_out = 0.0; ph = 0.0; seq = 0
    f = 997.0
    outs=[]; adj=[]; fills=[]
    # event loop in virtual time
    next_send = 0.0
    tq=[]  # pending deliveries (arrival_time, data)
    sent_frames = 0
    last_arr = 0.0
    while t_out < secs:
        # sender generates blocks on its clock; arrival delayed by jitter
        while next_send <= t_out + 0.2:
            n = np.arange(sent_frames, sent_frames+blk_in)
            s = (0.5*np.sin(2*math.pi*f*n/48000)).astype(np.float32)   # sender's samples at its own clock
            d = np.repeat(s[:,None],6,axis=1)
            arr = next_send + abs(rng.normal(0, jitter_ms/1000)) + (rng.uniform(*stall_ms)/1000 if rng.random()<stall_p else 0)  # occasional stall
            arr = max(arr, last_arr); last_arr = arr
            tq.append((arr, seq, d)); seq+=1; sent_frames += blk_in
            next_send += blk_in/rs
        tq.sort(key=lambda x:x[0])
        while tq and tq[0][0] <= t_out:
            a, sq, d = tq.pop(0); st.last_rx = 0; st.push(sq, 48000, d)
        # time.monotonic used for waiting state only; patch
        o = st.pull(blk_out, blk_out/48000)
        outs.append(o[:,0]); adj.append(st.adj); fills.append(st.fill_s)
        t_out += blk_out/rc
    y = np.concatenate(outs)
    adj=np.array(adj); fills=np.array(fills)
    # glitch check after settling (skip first 2 s): second difference vs. expected bound
    start = int(2*48000)
    seg = y[start:]
    d2 = np.abs(np.diff(seg,2)); bound = 0.5*(2*math.pi*f/48000)**2*1.5 + 1e-4
    glitches = int((d2 > bound*3).sum())
    last = slice(-int(60*48000/blk_out), None)
    print(f"sender {sender_ppm:+5} ppm  sink {sink_ppm:+5} ppm | underruns {st.underruns} drops {st.drops} "
          f"| adj last60s {adj[last].mean()*1e6:+7.1f} ppm (ideal {(sink_ppm-sender_ppm)*-1:+.0f}) "
          f"| fill last60s {fills[last].mean()*1000:5.1f}±{fills[last].std()*1000:4.1f} ms | glitches {glitches} "
          f"| >target+50ms for {(fills > (TARGET+50)/1000).sum()*blk_out/48000:5.1f} s")

# patch monotonic so waiting/prefill logic doesn't depend on wall time
rx.time.monotonic = lambda: 0.0
TARGET=60
print('-- realistic, 60 ms buffer')
for sp, kp in [(0,0),(0,+100),(+60,-60),(0,+250)]:
    run(sp, kp)
TARGET=100
print('-- bench 2 Nov: 150-330 ms stalls every ~35 s, 100 ms buffer')
for sp, kp in [(0,0),(0,+100)]:
    run(sp, kp, stall_p=1/3500, stall_ms=(150, 330))
