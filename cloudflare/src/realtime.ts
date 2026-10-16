// C5 — realtime hub (Durable Object, WebSocket hibernation). FE: GET /ws?topic=<t>.
export class RealtimeHub {
  state: DurableObjectState
  constructor(state: DurableObjectState) {
    this.state = state
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const data = await request.text()
      let n = 0
      for (const ws of this.state.getWebSockets()) {
        try {
          ws.send(data)
          n++
        } catch {
          /* ignore */
        }
      }
      return Response.json({ sent: n })
    }
    if (request.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 })
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.state.acceptWebSocket(server)
    server.send(JSON.stringify({ type: 'connected', topic: url.searchParams.get('topic') ?? '' }))
    return new Response(null, { status: 101, webSocket: client })
  }
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    // echo ping
    if (typeof message === 'string' && message === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
  }
  webSocketClose(ws: WebSocket): void {
    try {
      ws.close()
    } catch {
      /* ignore */
    }
  }
}
