/**
 * 🦆 Duck Agent - A2UI Renderer
 * Agent-to-User Interface Protocol
 * Based on Google A2UI specification v0.9
 */

export interface A2UIComponent {
  id: string;
  type: string;
  props: Record<string, any>;
}

export interface Surface {
  id: string;
  components: Map<string, A2UIComponent>;
  dataModel: Record<string, any>;
  rootElement?: HTMLElement;
}

// Message types from A2UI protocol
export type A2UIMessageType = 'createSurface' | 'updateComponents' | 'updateDataModel' | 'deleteSurface';

export interface CreateSurfaceMessage {
  type: 'createSurface';
  surfaceId: string;
  title?: string;
}

export interface UpdateComponentsMessage {
  type: 'updateComponents';
  surfaceId: string;
  components: A2UIComponent[];
}

export interface UpdateDataModelMessage {
  type: 'updateDataModel';
  surfaceId: string;
  path: string;
  value: any;
}

export interface DeleteSurfaceMessage {
  type: 'deleteSurface';
  surfaceId: string;
}

export type A2UIMessage = CreateSurfaceMessage | UpdateComponentsMessage | UpdateDataModelMessage | DeleteSurfaceMessage;

// Basic catalog components
const BASIC_CATALOG: Record<string, (props: any, children: any[], ctx: RenderContext) => string> = {
  Text: (props) => `<span class="a2ui-text">${resolveData(props.text, ctx)}</span>`,
  
  Button: (props) => {
    const label = resolveData(props.label, ctx);
    const action = props.onClick ? `onclick="${props.onClick}"` : '';
    return `<button class="a2ui-button a2ui-${props.variant || 'default'}" ${action}>${label}</button>`;
  },
  
  Card: (props, children) => {
    return `<div class="a2ui-card a2ui-${props.variant || 'default'}">${children.join('')}</div>`;
  },
  
  Row: (props, children) => {
    const gap = props.gap || 8;
    return `<div class="a2ui-row" style="gap:${gap}px">${children.join('')}</div>`;
  },
  
  Column: (props, children) => {
    const gap = props.gap || 8;
    return `<div class="a2ui-column" style="gap:${gap}px">${children.join('')}</div>`;
  },
  
  Image: (props) => {
    const src = resolveData(props.src, ctx);
    const alt = props.alt || '';
    const width = props.width ? `width="${props.width}"` : '';
    const height = props.height ? `height="${props.height}"` : '';
    return `<img class="a2ui-image" src="${src}" alt="${alt}" ${width} ${height}/>`;
  },
  
  Input: (props) => {
    const placeholder = props.placeholder || '';
    const value = props.value ? `value="${resolveData(props.value, ctx)}"` : '';
    return `<input class="a2ui-input" type="${props.type || 'text'}" placeholder="${placeholder}" ${value}/>`;
  },
  
  Badge: (props) => {
    const text = resolveData(props.text, ctx);
    return `<span class="a2ui-badge a2ui-${props.variant || 'default'}">${text}</span>`;
  },
  
  Divider: () => `<hr class="a2ui-divider"/>`,
  
  Spacer: (props) => {
    const height = props.height || 16;
    return `<div class="a2ui-spacer" style="height:${height}px"></div>`;
  },
};

let ctx: RenderContext;

export class A2UIRenderer {
  private surfaces: Map<string, Surface> = new Map();
  private catalog: Record<string, any>;
  private container: HTMLElement;
  
  constructor(container: HTMLElement, catalog?: Record<string, any>) {
    this.container = container;
    this.catalog = catalog || BASIC_CATALOG;
    ctx = { dataModel: {}, components: new Map() };
  }
  
  /**
   * Process an A2UI message stream
   */
  async processMessage(message: A2UIMessage): Promise<void> {
    switch (message.type) {
      case 'createSurface':
        this.createSurface(message);
        break;
      case 'updateComponents':
        this.updateComponents(message);
        break;
      case 'updateDataModel':
        this.updateDataModel(message);
        break;
      case 'deleteSurface':
        this.deleteSurface(message);
        break;
    }
  }
  
  /**
   * Process a stream of messages (async generator)
   */
  async *processStream(messages: AsyncIterable<A2UIMessage>): AsyncGenerator<void> {
    for await (const message of messages) {
      await this.processMessage(message);
      yield;
    }
  }
  
  createSurface(message: CreateSurfaceMessage): void {
    const surface: Surface = {
      id: message.surfaceId,
      components: new Map(),
      dataModel: {},
    };
    
    // Create DOM element
    const el = document.createElement('div');
    el.id = `a2ui-surface-${message.surfaceId}`;
    el.className = 'a2ui-surface';
    el.innerHTML = `<div class="a2ui-header">${message.title || 'A2UI Surface'}</div><div class="a2ui-content"></div>`;
    
    this.container.appendChild(el);
    surface.rootElement = el;
    this.surfaces.set(message.surfaceId, surface);
  }
  
  updateComponents(message: UpdateComponentsMessage): void {
    const surface = this.surfaces.get(message.surfaceId);
    if (!surface) {
      console.warn(`Surface ${message.surfaceId} not found`);
      return;
    }
    
    // Update components map
    for (const comp of message.components) {
      surface.components.set(comp.id, comp);
    }
    
    // Re-render surface
    this.renderSurface(surface);
  }
  
  updateDataModel(message: UpdateDataModelMessage): void {
    const surface = this.surfaces.get(message.surfaceId);
    if (!surface) return;
    
    // Update data model using JSON Pointer path
    const parts = message.path.split('/').filter(p => p);
    let current = surface.dataModel;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = message.value;
    
    // Re-render if needed
    this.renderSurface(surface);
  }
  
  deleteSurface(message: DeleteSurfaceMessage): void {
    const surface = this.surfaces.get(message.surfaceId);
    if (!surface) return;
    
    if (surface.rootElement) {
      surface.rootElement.remove();
    }
    
    this.surfaces.delete(message.surfaceId);
  }
  
  private renderSurface(surface: Surface): void {
    if (!surface.rootElement) return;
    
    const content = surface.rootElement.querySelector('.a2ui-content');
    if (!content) return;
    
    // Render all components
    content.innerHTML = this.renderComponents(Array.from(surface.components.values()));
  }
  
  private renderComponents(components: A2UIComponent[]): string {
    const rendered: string[] = [];
    
    for (const comp of components) {
      const renderer = this.catalog[comp.type];
      if (renderer) {
        const children = comp.props.children || [];
        rendered.push(renderer(comp.props, children, ctx));
      } else {
        rendered.push(`<div class="a2ui-unknown">Unknown component: ${comp.type}</div>`);
      }
    }
    
    return rendered.join('');
  }
  
  getSurface(id: string): Surface | undefined {
    return this.surfaces.get(id);
  }
  
  getAllSurfaces(): Surface[] {
    return Array.from(this.surfaces.values());
  }
  
  destroy(): void {
    for (const surface of this.surfaces.values()) {
      if (surface.rootElement) {
        surface.rootElement.remove();
      }
    }
    this.surfaces.clear();
  }
}

interface RenderContext {
  dataModel: Record<string, any>;
  components: Map<string, A2UIComponent>;
}

function resolveData(value: any, ctx: RenderContext): string {
  if (typeof value === 'string' && value.startsWith('$data:')) {
    const path = value.substring(6);
    const parts = path.split('/').filter(p => p);
    let current = ctx.dataModel;
    for (const part of parts) {
      current = current?.[part];
    }
    return current?.toString() || '';
  }
  return value?.toString() || '';
}

// CSS styles for A2UI components
export const A2UI_STYLES = `
.a2ui-surface {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 16px;
  margin: 8px 0;
  font-family: system-ui, sans-serif;
}

.a2ui-header {
  font-size: 14px;
  font-weight: 600;
  color: #888;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
}

.a2ui-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.a2ui-row {
  display: flex;
  flex-direction: row;
}

.a2ui-column {
  display: flex;
  flex-direction: column;
}

.a2ui-text {
  color: #fff;
  font-size: 14px;
}

.a2ui-button {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.a2ui-button.primary { background: #4f46e5; color: white; }
.a2ui-button.default { background: #333; color: #fff; }
.a2ui-button.danger { background: #dc2626; color: white; }

.a2ui-card {
  background: #16213e;
  border-radius: 8px;
  padding: 12px;
}

.a2ui-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.a2ui-badge.success { background: #065f46; color: #6ee7b7; }
.a2ui-badge.warning { background: #92400e; color: #fcd34d; }
.a2ui-badge.error { background: #991b1b; color: #fca5a5; }

.a2ui-input {
  background: #0f0f23;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 8px 12px;
  color: #fff;
  font-size: 14px;
  width: 100%;
}

.a2ui-divider {
  border: none;
  border-top: 1px solid #333;
  margin: 8px 0;
}
`;

export default A2UIRenderer;
