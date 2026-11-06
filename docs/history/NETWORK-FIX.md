> 历史资料：仅记录导入版本的实现过程。当前操作见 [玩家指南](../PLAYER-GUIDE.md)、[联机指南](../MULTIPLAYER.md) 和 [发布 SOP](../../SOP.md)。历史协议和中继说明不作为当前指导。

# v1.19.0 / protocol 22

Observed 2026-11-01: server load 0.08, available RAM ~894 MB; one TCP connection had 60,604 B Send-Q, 57,756 B notsent, 273 ms RTT and ~42 kbit/s delivery rate. Lifetime bytes_retrans/bytes_sent was ~18%; this is not a packet-loss percentage. User screenshot showed relay 116 ms, command ACK 33,810 ms and host 12 FPS.

The relay is not the simulation host: player-host rendering and authoritative simulation share the renderer. A full-state 20 Hz TCP stream plus verbose inputs can exceed a weak route and queue stale states before actions. Server CPU/RAM tuning alone does not address this.

`net-stream.cjs` implements per-stream stop-and-wait acknowledgements, latest-only pending state, recursive copy-on-write deltas with bounded inflate, 10 Hz state / 25 Hz input ceilings, and ordered terminal barriers. There are independent input streams for each remote slot on a host connection. TCP/TLS remains in use; no new ports or unauthenticated UDP.

Clients repeat the newest six 20 ms commands. Host queues deduplicate and cap 120 ms history; while fresh controls exist, remaining wall-time credit advances with those controls. Movement stops after 600 ms without input; held interactions tolerate up to 2.5 seconds of retries. Key transitions use a reliable priority control message and serial numbers prevent late coalesced inputs from undoing newer transitions. Two consecutive <35 FPS windows lower host render scale, updating shadows at 4 Hz without recompiling all scene shaders; three reductions maximum.

Protocol 21 rooms remain supported independently; protocol 22 participants all need this client. Game actions remain reliable, and hidden traps remain filtered per recipient before delta encoding. Copies prevent mutation of acknowledged baselines. Timers are cleared on close. Final pending state is sent before the result; lobby/start clears stale pending states.

Verification evidence is packaged alongside the executable. Synthetic constrained-link numbers are simulations, not measured public Internet guarantees.
