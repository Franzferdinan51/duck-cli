/**
 * Desktop Control
 */

export class DesktopControl {
  private url = 'http://127.0.0.1:3847';
  private connected = false;

  private async request(task: string): Promise<string> {
    const res = await fetch(`${this.url}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task })
    });
    const data = await res.json() as any;
    return data.result || JSON.stringify(data);
  }

  async connect(): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/status`);
      this.connected = res.ok;
      return this.connected;
    } catch { this.connected = false; return false; }
  }

  isConnected() { return this.connected; }
  async openApp(app: string) { return this.request(`Open ${app}`); }
  async click(x: number, y: number) { return this.request(`Click at ${x}, ${y}`); }
  async type(text: string) { return this.request(`Type: ${text}`); }
  async screenshot() { return this.request('Take screenshot'); }
  async press(key: string) { return this.request(`Press ${key}`); }
}

export default DesktopControl;
