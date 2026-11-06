> 历史资料：仅记录导入版本的实现过程。当前操作见 [玩家指南](../PLAYER-GUIDE.md)、[联机指南](../MULTIPLAYER.md) 和 [发布 SOP](../../SOP.md)。历史协议和中继说明不作为当前指导。

# v1.29.0 / game protocol 32

The default flow is Create Room → share one six-digit room number → Join Room. One number supports the host and four guests. The client automatically exchanges WebRTC offers, answers and ICE candidates; there are no copied SDP envelopes in the default UI. A manual, fully serverless exchange remains under Advanced.

The setup service is separate from the paused game server. It accepts only room creation/joining, availability, participant removal and a fixed set of connection-setup messages. Its module has no simulation or gameplay relay, and the client filters outbound setup messages too. TCP/TLS port 29805 is reserved for setup; the original game service on 29804 remains paused. The renderer cannot choose the setup service address; the main process connects to the fixed address with the bundled public certificate as its trust anchor.

The existing DirectRoom remains authoritative for slots, characters, readiness, start, inputs, snapshots, actions, trap privacy and results. Automatic setup uses trickle ICE so it does not wait for the 15-second manual collection window. Peer channels continue working when the setup service disappears. Joining by room number depends on setup availability; established matches do not.

Local validation creates five native WebRTC peers from one six-digit code. It verifies full/missing/started-room rejection, then stops the setup service and checks that P2P actions, snapshots and results still arrive. Actual 3D UI tests exercise both room creation and input-code joining and retain the loss/12 FPS gameplay regression from v1.21.1.

No relay fallback or TURN service is included. Automatic setup reduces user steps; it does not guarantee NAT traversal across VPNs or restrictive networks. The movement accounting, 600 ms command redundancy and host wall-time budget from v1.21.1 remain unchanged.

The fried-rice NPC and shoe restraint are simulated by the host and replicated with the match snapshot. Protocol 27 is required for all participants in a room. The setup service also retains isolated protocol-25 rooms, but refuses mixed-protocol joins.
