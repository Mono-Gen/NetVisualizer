# NetVisualizer Operation Manual

**Target Audience**: Beginners in Networking  
**Version**: 0.9.1

---

## Introduction

NetVisualizer is an educational network simulator that lets you learn how TCP/IP networks work by seeing packet flow in real time and controlling it with your own hands.

With this tool, you can:

- Place PCs, servers, switches, and routers on a virtual canvas to build your own network
- Visualize in real time how packets travel from source to destination
- Experiment with major protocols: ICMP (Ping), TCP, UDP, DHCP, DNS, and IGMP (Multicast)
- Safely observe what happens when you make configuration mistakes (wrong subnet mask, missing gateway, etc.)

> **Key Point**: The simulator faithfully follows real-world network standards (RFCs). Everything you learn here translates directly to real network engineering.

---

## Chapter 1 — Screen Layout

```
┌─────────────────────────────────────────────────────────┐
│  [+ Design]  [▶ Simulate]          NETVISUALIZER        │  ← Header
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Left Pane   │         Canvas (Work Area)               │
│  (Command    │  Nodes and links are displayed here      │
│   Panel)     │                                          │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│  PACKET LOGS                                            │  ← Log Panel
└─────────────────────────────────────────────────────────┘
```

### 1.1 Switching Modes

| Button | Mode | What You Can Do |
|--------|------|-----------------|
| `+ Design` | Design Mode | Place/delete/connect nodes, set IP addresses |
| `▶ Simulate` | Simulation Mode | Send packets, observe protocol behavior |

> **Important**: Build your network correctly in Design Mode before switching to Simulation Mode.

---

## Chapter 2 — Building a Network (Design Mode)

### 2.1 Node Types

| Icon | Type | Role |
|------|------|------|
| 🖥 PC | End Host | Generates and receives network traffic |
| 🗄 Server | Server | Provides web, DNS, DHCP, and other services |
| 🔀 Switch | L2 Switch | Learns MAC addresses and forwards frames (Layer 2) |
| 🔁 Router | Router | Connects different networks (Layer 3 routing) |
| 📡 Hub | Hub | Copies packets to all ports (legacy device) |

### 2.2 Adding Nodes

1. In Design Mode, **right-click** on an empty area of the canvas.
2. Choose the node type from the menu.
3. Drag the node to adjust its position.

### 2.3 Configuring a Node

Click a node to select it. A settings panel will open in the left pane.

#### IP Address Settings

| Field | Description | Example |
|-------|-------------|---------|
| IP Address | This node's IP address | `192.168.1.10` |
| Subnet Mask | Defines the network boundary | `255.255.255.0` (/24) |
| Gateway | Default gateway IP (required for inter-subnet traffic) | `192.168.1.1` |
| DNS | IP address of the DNS server | `192.168.2.20` |

> **Glossary**:
> - **IP Address**: A unique address on the network, like a postal address.
> - **Subnet Mask**: Determines which part of an IP address is the "network" vs the "host." Nodes with the same network portion can communicate directly.
> - **Gateway**: The IP address of the router that acts as the "exit door" to other networks.

### 2.4 Creating Links (Cables)

1. Select the port/interface on one node.
2. Drag to the port of another node and release to create a **link** (virtual cable).

### 2.5 Example Topology

```
[PC 1] ─── [Switch] ─── [Router] ─── [Server]
 192.168.1.10    L2 fwd  192.168.1.1 / 192.168.2.1  192.168.2.20
  /24                      GW=192.168.1.1                /24
```

---

## Chapter 3 — Sending Traffic (Simulation Mode)

Press `▶ Simulate` and click the node you want to use as the source.

### 3.1 Ping (ICMP Echo Request / Reply)

**What is Ping?**: The most basic connectivity check — "Can I reach you?"

#### Steps

1. Click the source node to select it.
2. In the left pane under "COMMAND FOR [Node Name]", enter the **destination IP address** (e.g., `192.168.2.20`).
3. Press the `Ping` button.

#### What to Observe

- Watch the packet animation moving across the canvas.
- Notice that an **ARP Request** is sent first — the node needs to know the MAC address of the next hop.
- If successful, an `echo-reply` returns to the source.

#### Common Failure Patterns

| Error Log | Cause | Fix |
|-----------|-------|-----|
| `No Gateway` | Gateway not configured | Set the Gateway IP in Design Mode |
| `TTL Expired` | Packet looped or routed too many hops | Check routing configuration |
| `Host Unreachable` | No route found | Verify router interface IPs |

### 3.2 UDP Send (L4 Messaging)

**What is UDP?**: A fire-and-forget protocol — fast, but with no guarantee of delivery.  
Used for video streaming, DNS queries, VoIP, and gaming.

#### Steps

1. Select the source node.
2. In the left pane under "L4 MESSAGING", enter a port number (e.g., `8080`) and a message.
3. Press `UDP Send`.

#### What to Observe

- If the destination node has **no service listening** on that port, an `ICMP Port Unreachable` error is returned.
- To open a port on a server, use the "Services" tab in Design Mode to add a listening port.

> **RFC Note**: For multicast destinations (`224.x.x.x`), **ICMP Port Unreachable is never sent**, even if the port is closed. This prevents error flooding on the network (RFC 1122).

### 3.3 TCP Connection (3-Way Handshake)

**What is TCP?**: A connection-oriented protocol that guarantees reliable, ordered data delivery.  
Used by web browsers (HTTP), email (SMTP), and most application-layer protocols.

#### Steps

1. Select the source node.
2. Enter the destination port (e.g., `80`).
3. Press `TCP Connect` to initiate the handshake.

#### The Connection Flow

```
Client (PC)                       Server
    │                               │
    │─── SYN ─────────────────────> │  "I want to connect"
    │<── SYN-ACK ───────────────── │  "Acknowledged"
    │─── ACK ─────────────────────> │  "Connection established!"
    │                               │
    │ ====== ESTABLISHED ======     │
    │                               │
    │─── TCP Send ────────────────> │  Data transfer
    │                               │
    │─── FIN ─────────────────────> │  "I want to disconnect"
    │<── FIN-ACK ────────────────── │  "Acknowledged"
```

---

## Chapter 4 — Network Services

### 4.1 DHCP (Automatic IP Address Assignment)

**What is DHCP?**: The protocol that automatically assigns IP addresses to devices.  
When you connect to Wi-Fi and automatically get an IP address, that's DHCP at work.

#### Setup (Design Mode)

Place a DHCP Server node and configure:
- **IP Pool**: Range of addresses to distribute (e.g., `192.168.1.100` – `192.168.1.200`)
- **Lease Time**: How long to lend each address
- **Gateway / DNS**: Settings pushed to clients

#### Steps (DORA Process)

1. Select a PC with IP address `0.0.0.0`.
2. Press `DHCP Renew`.

#### The DORA Flow

```
PC                                DHCP Server
 │─── DISCOVER (broadcast) ─────> │  "Anyone have an IP for me?"
 │<── OFFER ─────────────────────  │  "Here, take 192.168.1.100"
 │─── REQUEST (broadcast) ──────> │  "I'll take that one, please"
 │<── ACK ────────────────────────  │  "Confirmed, it's yours!"
```

> **Key Point**: DHCP uses broadcast messages. Broadcasts cannot cross routers (TTL=1), so the DHCP server must be on the **same L2 segment** as the client.

### 4.2 mDNS Query (Multicast DNS)

**What is mDNS?**: Resolves hostnames on a local network **without a DNS server**.  
Used by Apple's Bonjour, network printers, Chromecast, and many IoT devices.

#### Steps

1. Select the querying node.
2. Press `mDNS Query` in the "NETWORK SERVICES" section of the left pane.

#### Communication Flow

```
PC                               Multicast Group 224.0.0.251
 │─── mDNS Query (multicast) ──────────────────────────────>
 │
 │                              Responding Server
 │<── mDNS Response (unicast) ──────────────────────────────
```

> **Requirement**: The responding node must have **mDNS RESPONDER set to ENABLED** and be a member of the `224.0.0.251` multicast group.

---

## Chapter 5 — Multicast and IGMP

### 5.1 What is Multicast?

**Multicast** is a communication method that delivers data to **all registered members of a group simultaneously**.

| Method | Recipients | Real-World Analogy |
|--------|------------|-------------------|
| Unicast | One specific host | A phone call |
| Broadcast | Everyone on the segment | AM radio |
| **Multicast** | All group members | Paid cable TV channel |

### 5.2 Joining a Multicast Group

To **receive** multicast traffic, a node must first **join** that group.  
The sender does NOT need to be a member to send (a TV station doesn't watch its own broadcasts).

#### Steps

1. Select the node you want to add to a group.
2. In the left pane, find the "MULTICAST GROUP" field and enter a group address (e.g., `224.2.2.2`).
3. Press `Join`.
4. A yellow **"JOINED GROUPS"** bubble will appear below the node on the canvas.

> **What happens behind the scenes**: Pressing `Join` automatically sends an **IGMP Membership Report** packet to the switch. The switch uses this to learn which ports have group members, enabling intelligent multicast forwarding.

### 5.3 Leaving a Group

1. Press `Leave` in the same panel.
2. The node is removed from the group, and the switch's IGMP Snooping table is updated automatically.

### 5.4 Observing IGMP Snooping

**IGMP Snooping** is how a switch "listens in" on IGMP traffic to learn which ports have group members — enabling **targeted multicast forwarding** instead of flooding.

#### How to Observe

1. After a node joins a group, look at the **switch** it's connected to.
2. The switch will display an **"IGMP SNOOPING"** table below its icon.
3. The table shows which group addresses map to which ports, along with the remaining lifetime of each entry.

```
┌────────────────────────────────────────┐
│         IGMP SNOOPING TABLE            │
│  Router Port: eth2  (expires in 58s)   │
│  224.2.2.2                             │
│    └─ eth0  (expires in 27s)           │
│  224.0.0.251                           │
│    └─ eth1  (expires in 14s)           │
└────────────────────────────────────────┘
```

> **Why This Matters**: Without IGMP Snooping, multicast would flood all ports, wasting bandwidth. The snooping table ensures traffic only goes where it's needed.

---

### 5.5 Switch Management IP

An L2/L3 Switch can have an optional **management IP address** configured on its VLAN 1 interface.

#### How to Configure

Click the switch → open the **"SWITCH IGMP CONFIG"** panel → fill in the **Management Interface (VLAN 1)** section.

| Field | Description | Example |
|-------|-------------|---------|
| IP Address | Switch's management IP | `192.168.1.254` |
| Subnet Mask | Management subnet mask | `255.255.255.0` |

#### Key Points

- If no management IP is set, the device shows **"UNMANAGED L2 SWITCH"** and operates as a plain L2 forwarder.  
- If a management IP is set, it shows **"MANAGED L2 SWITCH"**.
- **The management IP subnet is completely independent from the PC/host subnet.**  
  Even if the switch uses `10.0.0.0/24` while all PCs use `192.168.1.0/24`, L2 forwarding between PCs is unaffected.  
  This demonstrates a core networking principle: the *control plane* (management) and the *data plane* (frame forwarding) operate independently.
- The management IP is required to enable the **IGMP Querier** function.

---

### 5.6 IGMP Snooping — Advanced Settings

#### Enabling / Disabling Snooping

| State | Behavior |
|-------|----------|
| **ENABLED** (default) | Learns group membership; forwards multicast only to registered ports |
| **DISABLED** | Floods multicast to all ports (hub-like behavior) |

#### Snooping Aging Time

Each entry in the snooping table has a **time-to-live (TTL)** called the **Aging Time**.  
When a port's timer reaches zero and no refresh arrives, that port is removed from the group.

| Parameter | Default | Configurable Range |
|-----------|---------|-------------------|
| Snooping Aging Time | 30 sec | 5 – 300 sec |

You can adjust this value in the **SWITCH IGMP CONFIG** panel while IGMP Snooping is enabled.

#### ⚠️ Important: Strict Drop Behavior (by Design)

> This simulator implements **RFC 4541 Approach B — Strict Multicast Filtering**.
>
> When IGMP Snooping is **ENABLED** and the destination multicast group has **no registered ports** in the snooping table (either because no one has joined, or because the entry has aged out), the packet is **immediately dropped and NOT flooded**.
>
> This is intentional. The purpose is to make the following observable and educational:
> - The instant an entry expires, multicast delivery stops completely.
> - Simply joining a group is not enough for sustained delivery — the membership must be continuously refreshed (via an IGMP Querier).
> - This makes the role of the Querier vivid and undeniable.
>
> **Exception — Link-Local Multicast (`224.0.0.0/24`):**  
> Addresses like `224.0.0.1` (All Hosts) and `224.0.0.251` (mDNS) are always flooded to all ports regardless of the snooping table, in compliance with RFC 4541. These are infrastructure-level multicast addresses that must not be filtered.

---

### 5.7 IGMP Querier

The **IGMP Querier** periodically sends **IGMP General Query** messages to all ports, prompting group members to re-report their membership. This prevents snooping table entries from expiring.

#### Requirements

- The switch must have a **management IP** configured.

#### How to Enable

Click the switch → **SWITCH IGMP CONFIG** → toggle **IGMP Querier** to **ENABLED**.

#### Querier Status

| Status | Meaning |
|--------|---------|
| **Active** | This switch is the elected querier; it sends periodic General Queries |
| **Standby (Lost Election)** | Another querier with a lower IP is active; this switch is silent |

#### Query Interval

The interval at which General Queries are sent.

| Parameter | Default | Configurable Range |
|-----------|---------|-------------------|
| Query Interval | 60 sec | 5 – 300 sec |

Shorter intervals refresh entries faster but generate more IGMP traffic.

#### Querier Election

If multiple switches on the same segment have the Querier enabled, they automatically elect a single **Active Querier**:

- The switch with the **lowest management IP address** wins the election and becomes Active.
- All others enter **Standby** mode and suppress their queries.
- This mimics real-world IGMP Querier election behavior (RFC 2236).

#### Manual Query

Press **[Send General Query]** to immediately send a General Query from all ports of the switch, regardless of Querier state. Useful for instantly refreshing the snooping table during testing.

---

### 5.8 Router Port (mrouter) Learning

When IGMP Snooping is enabled, the switch automatically learns which port leads toward a **multicast router or Active Querier**.

- When a General Query arrives on port P, that port is recorded as the **mrouter port**.
- Multicast traffic for any group is always forwarded to the mrouter port (routers need to receive all multicast for routing/PIM purposes).
- The mrouter port entry expires after `Aging Time × 2` seconds.
- The current mrouter port and its remaining lifetime are shown in the **IGMP SNOOPING TABLE** on the canvas.

---

### 5.9 Learning Scenarios

#### Scenario A — Aging Out Without a Querier

1. Switch: **Snooping ON, Querier OFF**, Aging Time = **30 sec**
2. PC joins group `239.1.1.1` → entry appears in the snooping table with a 30-second countdown.
3. Wait 30 seconds without sending any IGMP traffic.
4. The entry disappears → subsequent multicast to `239.1.1.1` is **dropped** and does not reach the PC.

→ **Lesson**: Without a querier, snooping entries eventually expire and multicast delivery silently stops.

#### Scenario B — Sustained Delivery With a Querier

1. Switch: Management IP set, **Snooping ON, Querier ON**, Query Interval = **15 sec**, Aging Time = **20 sec**
2. PC joins the group → entry appears.
3. Every 15 seconds, the switch sends a General Query → PC replies with a Report → entry timer resets.
4. The timer never reaches zero; multicast delivery continues indefinitely.

→ **Lesson**: The Querier acts as a heartbeat, keeping snooping entries alive and multicast flowing.

#### Scenario C — Multi-Switch Querier Election

1. SwitchA (IP: `10.0.0.1`) and SwitchB (IP: `10.0.0.2`) connected directly; both Querier ON.
2. SwitchA (lower IP) becomes **Active**; SwitchB enters **Standby**.
3. SwitchB records its uplink to SwitchA as its **mrouter port** upon receiving SwitchA's Query.
4. Multicast is correctly forwarded across both switches via the mrouter port.

→ **Lesson**: Querier election prevents duplicate queries; mrouter port learning enables cross-switch multicast forwarding.

---

## Chapter 6 — Reading the Pedagogical Tables

When packets flow through the network, nodes automatically display the information they have "learned."

### 6.1 ARP TABLE

- **Displayed on**: PCs, Servers, Routers
- **Contents**: Mapping of IP addresses to MAC addresses
- **Purpose**: When a node knows the destination IP but needs the MAC address to actually send the frame, it looks here first. If the entry is missing, it sends an ARP Request.

```
┌────────────────────────┐
│       ARP TABLE        │
│  192.168.1.1 → AA:BB  │  ← Gateway's MAC address
│  192.168.1.11 → CC:DD │  ← Peer PC on the same subnet
└────────────────────────┘
```

> **Glossary (ARP)**: Address Resolution Protocol. Answers the question: "Who has IP address X? Tell me your MAC." The owner replies with their MAC address.

### 6.2 MAC TABLE

- **Displayed on**: Switches
- **Contents**: Mapping of MAC addresses to switch ports
- **Purpose**: Allows the switch to forward frames to the correct port instead of flooding all ports

```
┌────────────────────────┐
│       MAC TABLE        │
│  AA:BB:CC → eth0       │  ← Device AA:BB:CC is behind eth0
│  DD:EE:FF → eth1       │
└────────────────────────┘
```

> **Why it matters**: Without a MAC table, switches behave like hubs — flooding all frames to all ports. MAC learning enables efficient, targeted forwarding.

### 6.3 DNS CACHE

- **Displayed on**: PCs, Servers
- **Contents**: Resolved hostname-to-IP mappings
- **Purpose**: Caches DNS responses so future queries don't need to contact the server again

```
┌────────────────────────────────┐
│          DNS CACHE             │
│  server1.local → 192.168.2.20 │
└────────────────────────────────┘
```

### 6.4 JOINED GROUPS

- **Displayed on**: PCs, Servers
- **Contents**: List of multicast group addresses the node has joined

```
┌──────────────────────┐
│    JOINED GROUPS     │
│    224.0.0.251       │  ← mDNS group
│    224.2.2.2         │  ← Custom multicast group
└──────────────────────┘
```

---

## Chapter 7 — Reading the Packet Logs

The log panel at the bottom shows all network events in chronological order.

### Log Types

| Color / Type | Meaning |
|-------------|---------|
| **Blue (RCVD / received)** | Packet successfully received |
| **Green (sent)** | Packet successfully sent |
| **Red (ERROR)** | An error occurred (port unreachable, host unreachable, etc.) |
| **Gray (dropped)** | Packet intentionally discarded (multicast group not joined, L2 filter, etc.) |

### Sample Log Entry

```
[ERROR]  21:24:56
169.254.181.224 → 224.2.2.2
UDP Port 8080 closed. Sending ICMP Port Unreachable.
```

- **Source IP → Destination IP**: Who sent to whom
- **Description**: What happened

---

## Chapter 8 — Troubleshooting Guide

When communication fails, work through this checklist in order.

### ✅ Layer 2 Checks (Physical / MAC)

- [ ] Are all links (cables) properly connected?
- [ ] Does the switch's MAC table contain the destination MAC?

### ✅ Layer 3 Checks (IP / Routing)

- [ ] Are the source and destination in the same subnet? (If not, a gateway is required)
- [ ] Is the gateway IP correctly configured on the source node?
- [ ] Is the gateway IP within the same subnet as the source?
- [ ] Does the router have IP addresses configured on both interfaces?

### ✅ Layer 4 Checks (Port)

- [ ] Is the destination port open (listening) on the server?

### ✅ Multicast-Specific Checks

- [ ] Has the receiving node joined the multicast group?
- [ ] Is `mDNS RESPONDER` set to **ENABLED** on the responding node?

### Common Mistakes

#### ❌ Wrong: Gateway is outside the subnet
```
PC:  IP=192.168.1.10  Mask=255.255.255.0  GW=10.0.0.1  ← 10.x.x is NOT in the /24 subnet!
```

#### ✅ Correct
```
PC:      IP=192.168.1.10   Mask=255.255.255.0  GW=192.168.1.1
Router:  LAN=192.168.1.1   WAN=10.0.0.1
```

---

## Appendix A — Protocol Reference

| Protocol | Layer | Purpose | RFC Reference |
|----------|-------|---------|---------------|
| ARP | L2/L3 boundary | Resolve IP to MAC | RFC 826 |
| ICMP | L3 | Connectivity check and error reporting | RFC 792 |
| IGMP | L3 (Multicast control) | Multicast group management | RFC 1112, RFC 2236 |
| UDP | L4 | Lightweight, fast data transfer | RFC 768 |
| TCP | L4 | Reliable, ordered data transfer | RFC 793 |
| DHCP | L7 (over UDP) | Automatic IP assignment | RFC 2131 |
| DNS | L7 (over UDP/TCP) | Hostname resolution | RFC 1035 |
| mDNS | L7 (over UDP/Multicast) | Local hostname resolution | RFC 6762 |

## Appendix B — Quick Reference

| Action | How |
|--------|-----|
| Add a node | Right-click on the canvas |
| Select a node | Click on it |
| Move a node | Drag it |
| Clear logs | Press the `Clear Logs` button |
| Switch modes | Use `+ Design` / `▶ Simulate` buttons |

---

*This manual is for NetVisualizer v0.9.1.*
