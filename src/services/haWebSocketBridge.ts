import { FloorplanProject, HADomain, HAEntityState } from '../types/floorplan';

export type ConnectionStatus = 'simulated' | 'connecting' | 'connected' | 'error';

export interface NativeHassObject {
  states?: Record<
    string,
    {
      entity_id: string;
      state: string;
      attributes?: Record<string, unknown>;
      last_changed?: string;
    }
  >;
  callService?: (
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>
  ) => Promise<unknown>;
  callWS?: <T = unknown>(msg: Record<string, unknown>) => Promise<T>;
  connection?: {
    subscribeEvents?: (
      callback: (ev: { data?: { project?: FloorplanProject } }) => void,
      eventType: string
    ) => Promise<() => void>;
  };
}

declare global {
  interface Window {
    __REALPLAN_HASS__?: NativeHassObject;
  }
}

export class HAWebSocketBridge {
  private ws: WebSocket | null = null;
  private nativeHass: NativeHassObject | null = null;
  private nativeSubscribed = false;
  private msgId = 20;
  private status: ConnectionStatus = 'simulated';
  private errorMessage: string | null = null;
  private onStateUpdate: (entities: Record<string, HAEntityState>) => void;
  private onStatusChange: (status: ConnectionStatus, error?: string) => void;
  private onRemoteProjectLoaded?: (project: FloorplanProject) => void;
  private pendingRequests = new Map<
    number,
    { resolve: (res: unknown) => void; reject: (err: unknown) => void }
  >();
  private boundHassListener: () => void;

  private postMessageConnected = false;
  private boundMessageListener: (event: MessageEvent) => void;

  constructor(
    onStateUpdate: (entities: Record<string, HAEntityState>) => void,
    onStatusChange: (status: ConnectionStatus, error?: string) => void,
    onRemoteProjectLoaded?: (project: FloorplanProject) => void
  ) {
    this.onStateUpdate = onStateUpdate;
    this.onStatusChange = onStatusChange;
    this.onRemoteProjectLoaded = onRemoteProjectLoaded;

    this.boundHassListener = () => {
      const injected = this.findInjectedHass();
      if (injected) {
        this.attachNativeHass(injected);
      }
    };

    this.boundMessageListener = (event: MessageEvent) => {
      const data = event?.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'REALPLAN_HASS_UPDATE') {
        this.postMessageConnected = true;
        if (this.status !== 'connected') {
          this.setStatus('connected');
        }
        if (data.states && typeof data.states === 'object') {
          this.ingestRawStatesMap(data.states as Record<string, unknown>);
        }
        if (
          data.project &&
          this.isValidRealProject(data.project as FloorplanProject) &&
          this.onRemoteProjectLoaded
        ) {
          this.onRemoteProjectLoaded(data.project as FloorplanProject);
        }
      } else if (data.type === 'REALPLAN_PROJECT_UPDATED') {
        if (
          data.project &&
          this.isValidRealProject(data.project as FloorplanProject) &&
          this.onRemoteProjectLoaded
        ) {
          this.onRemoteProjectLoaded(data.project as FloorplanProject);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('realplan3d-hass-update', this.boundHassListener);
      window.addEventListener('message', this.boundMessageListener);
      setTimeout(() => {
        this.boundHassListener();
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'REALPLAN_STUDIO_READY' }, '*');
          }
        } catch {
          // Ignore cross-frame notification error
        }
      }, 60);
    }
  }

  /**
   * Filters out the old 4-box DEFAULT_STARTER_PROJECT dummy so it never overwrites
   * a user's real floorplan in Home Assistant .storage.
   */
  private isValidRealProject(proj: FloorplanProject | null | undefined): proj is FloorplanProject {
    if (!proj || !Array.isArray(proj.zones) || proj.zones.length === 0) return false;
    const ids = new Set(proj.zones.map((z) => z.id));
    const isOldStarterDummy =
      proj.zones.length === 4 &&
      ids.has('zone_living') &&
      ids.has('zone_kitchen') &&
      ids.has('zone_og_master') &&
      ids.has('zone_terrace') &&
      (!Array.isArray(proj.assets) || proj.assets.length === 0);
    return !isOldStarterDummy;
  }

  private ingestRawStatesMap(rawStates: Record<string, unknown>) {
    const mapped: Record<string, HAEntityState> = {};
    for (const item of Object.values(rawStates)) {
      const raw = item as {
        entity_id?: string;
        state?: string;
        attributes?: Record<string, unknown>;
        last_changed?: string;
      };
      if (!raw || !raw.entity_id) continue;
      const domain = String(raw.entity_id).split('.')[0] as HADomain;
      mapped[raw.entity_id] = {
        entity_id: raw.entity_id,
        domain,
        state: String(raw.state ?? 'unknown'),
        attributes: {
          friendly_name:
            (raw.attributes?.friendly_name as string) || raw.entity_id,
          ...(raw.attributes || {}),
        },
        last_changed: raw.last_changed || new Date().toISOString(),
      };
    }
    this.onStateUpdate(mapped);
  }

  private findInjectedHass(): NativeHassObject | null {
    if (typeof window === 'undefined') return null;
    if (window.__REALPLAN_HASS__) return window.__REALPLAN_HASS__;
    try {
      const parentWin = window.parent as Window | undefined;
      if (parentWin && parentWin !== window && parentWin.__REALPLAN_HASS__) {
        return parentWin.__REALPLAN_HASS__;
      }
    } catch {
      // Ignore cross-origin parent access
    }
    return null;
  }

  public attachNativeHass(hass: NativeHassObject) {
    const isFirstAttach = !this.nativeHass;
    this.nativeHass = hass;

    if (this.status !== 'connected') {
      this.setStatus('connected');
    }

    if (hass.states) {
      this.ingestRawStatesMap(hass.states as Record<string, unknown>);
    }

    if (isFirstAttach && !this.nativeSubscribed) {
      this.nativeSubscribed = true;
      void this.loadProjectFromHA().then((remoteProj) => {
        if (this.isValidRealProject(remoteProj) && this.onRemoteProjectLoaded) {
          this.onRemoteProjectLoaded(remoteProj);
        }
      });

      if (hass.connection?.subscribeEvents) {
        void hass.connection.subscribeEvents((ev) => {
          const remoteProj = ev?.data?.project;
          if (this.isValidRealProject(remoteProj) && this.onRemoteProjectLoaded) {
            this.onRemoteProjectLoaded(remoteProj);
          }
        }, 'realplan3d_project_updated');
      }
    }
  }

  public connect(haUrl: string, accessToken: string) {
    this.disconnect(false);
    const cleaned = haUrl.trim().replace(/\/+$/, '');
    if (!cleaned || !accessToken.trim()) {
      this.setStatus('error', 'Bitte gültige Home Assistant URL und Long-Lived Access Token eingeben.');
      return;
    }

    const wsUrl =
      cleaned.startsWith('https://')
        ? cleaned.replace(/^https:\/\//, 'wss://') + '/api/websocket'
        : cleaned.startsWith('http://')
        ? cleaned.replace(/^http:\/\//, 'ws://') + '/api/websocket'
        : `ws://${cleaned}/api/websocket`;

    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(wsUrl);
      const getStatesId = 10;
      const subscribeId = 11;
      const subscribeProjectEventId = 12;
      const getSavedProjectId = 13;

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'auth_required') {
            this.ws?.send(
              JSON.stringify({
                type: 'auth',
                access_token: accessToken.trim(),
              })
            );
          } else if (data.type === 'auth_ok') {
            this.setStatus('connected');
            this.ws?.send(JSON.stringify({ id: getStatesId, type: 'get_states' }));
            this.ws?.send(
              JSON.stringify({
                id: subscribeId,
                type: 'subscribe_events',
                event_type: 'state_changed',
              })
            );
            this.ws?.send(
              JSON.stringify({
                id: subscribeProjectEventId,
                type: 'subscribe_events',
                event_type: 'realplan3d_project_updated',
              })
            );
            this.ws?.send(
              JSON.stringify({
                id: getSavedProjectId,
                type: 'realplan3d/get_project',
              })
            );
          } else if (data.type === 'auth_invalid') {
            this.setStatus('error', data.message || 'Ungültiger Home Assistant Access Token');
            this.disconnect(false);
          } else if (data.type === 'result' && data.id === getStatesId && Array.isArray(data.result)) {
            const mapped: Record<string, HAEntityState> = {};
            for (const raw of data.result) {
              const domain = String(raw.entity_id).split('.')[0] as HADomain;
              mapped[raw.entity_id] = {
                entity_id: raw.entity_id,
                domain,
                state: String(raw.state),
                attributes: {
                  friendly_name: raw.attributes?.friendly_name || raw.entity_id,
                  ...raw.attributes,
                },
                last_changed: raw.last_changed || new Date().toISOString(),
              };
            }
            this.onStateUpdate(mapped);
          } else if (data.type === 'result' && data.id === getSavedProjectId) {
            const remoteProj = data.result?.project as FloorplanProject | undefined;
            if (
              data.success &&
              this.isValidRealProject(remoteProj) &&
              this.onRemoteProjectLoaded
            ) {
              this.onRemoteProjectLoaded(remoteProj);
            }
          } else if (data.type === 'result' && this.pendingRequests.has(data.id)) {
            const req = this.pendingRequests.get(data.id)!;
            this.pendingRequests.delete(data.id);
            if (data.success) {
              req.resolve(data.result);
            } else {
              req.reject(new Error(data.error?.message || 'HA WebSocket Fehler'));
            }
          } else if (data.type === 'event' && data.event?.event_type === 'realplan3d_project_updated') {
            const remoteProj = data.event?.data?.project as FloorplanProject | undefined;
            if (this.isValidRealProject(remoteProj) && this.onRemoteProjectLoaded) {
              this.onRemoteProjectLoaded(remoteProj);
            }
          } else if (data.type === 'event' && data.event?.data?.new_state) {
            const raw = data.event.data.new_state;
            const domain = String(raw.entity_id).split('.')[0] as HADomain;
            this.onStateUpdate({
              [raw.entity_id]: {
                entity_id: raw.entity_id,
                domain,
                state: String(raw.state),
                attributes: {
                  friendly_name: raw.attributes?.friendly_name || raw.entity_id,
                  ...raw.attributes,
                },
                last_changed: raw.last_changed || new Date().toISOString(),
              },
            });
          }
        } catch {
          // Ignore malformed WS packets
        }
      };

      this.ws.onerror = () => {
        this.setStatus(
          'error',
          'WebSocket-Verbindung zu Home Assistant fehlgeschlagen (CORS / Netzwerk prüfen). Simulator bleibt aktiv.'
        );
      };

      this.ws.onclose = () => {
        if (this.status === 'connected' && !this.nativeHass && !this.postMessageConnected) {
          this.setStatus('simulated');
        }
      };
    } catch (err) {
      this.setStatus('error', err instanceof Error ? err.message : 'Verbindungsfehler');
    }
  }

  public callService(domain: string, service: string, serviceData: Record<string, unknown>) {
    if (this.nativeHass?.callService) {
      void this.nativeHass.callService(domain, service, serviceData);
      return true;
    }
    if (this.postMessageConnected && typeof window !== 'undefined' && window.parent !== window) {
      try {
        window.parent.postMessage(
          {
            type: 'REALPLAN_CALL_SERVICE',
            domain,
            service,
            serviceData,
          },
          '*'
        );
        return true;
      } catch {
        // Ignore postMessage error
      }
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.status === 'connected') {
      this.msgId += 1;
      this.ws.send(
        JSON.stringify({
          id: this.msgId + 100,
          type: 'call_service',
          domain,
          service,
          service_data: serviceData,
        })
      );
      return true;
    }
    return false;
  }

  public async saveProjectToHA(project: FloorplanProject): Promise<boolean> {
    if (this.nativeHass?.callWS) {
      try {
        await this.nativeHass.callWS({
          type: 'realplan3d/save_project',
          project,
        });
        return true;
      } catch {
        return false;
      }
    }
    if (this.postMessageConnected && typeof window !== 'undefined' && window.parent !== window) {
      try {
        window.parent.postMessage(
          {
            type: 'REALPLAN_SAVE_PROJECT',
            project,
          },
          '*'
        );
        return true;
      } catch {
        return false;
      }
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.status !== 'connected') {
      return false;
    }
    this.msgId += 1;
    const reqId = this.msgId + 500;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        resolve(false);
      }, 5000);
      this.pendingRequests.set(reqId, {
        resolve: () => {
          clearTimeout(timer);
          resolve(true);
        },
        reject: () => {
          clearTimeout(timer);
          resolve(false);
        },
      });
      this.ws?.send(
        JSON.stringify({
          id: reqId,
          type: 'realplan3d/save_project',
          project,
        })
      );
    });
  }

  public async loadProjectFromHA(): Promise<FloorplanProject | null> {
    if (this.nativeHass?.callWS) {
      try {
        const res = await this.nativeHass.callWS<{ project?: FloorplanProject }>({
          type: 'realplan3d/get_project',
        });
        if (this.isValidRealProject(res?.project)) {
          return res!.project!;
        }
        return null;
      } catch {
        return null;
      }
    }
    if (this.postMessageConnected && typeof window !== 'undefined' && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'REALPLAN_GET_PROJECT' }, '*');
      } catch {
        // Ignore
      }
      return null;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.status !== 'connected') {
      return null;
    }
    this.msgId += 1;
    const reqId = this.msgId + 500;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        resolve(null);
      }, 5000);
      this.pendingRequests.set(reqId, {
        resolve: (res: unknown) => {
          clearTimeout(timer);
          const proj = (res as { project?: FloorplanProject })?.project;
          if (this.isValidRealProject(proj)) {
            resolve(proj);
          } else {
            resolve(null);
          }
        },
        reject: () => {
          clearTimeout(timer);
          resolve(null);
        },
      });
      this.ws?.send(
        JSON.stringify({
          id: reqId,
          type: 'realplan3d/get_project',
        })
      );
    });
  }

  public disconnect(resetToSimulated = true) {
    if (typeof window !== 'undefined' && resetToSimulated) {
      window.removeEventListener('realplan3d-hass-update', this.boundHassListener);
      window.removeEventListener('message', this.boundMessageListener);
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.pendingRequests.clear();
    if (resetToSimulated && !this.nativeHass && !this.postMessageConnected) {
      this.setStatus('simulated');
    }
  }

  private setStatus(status: ConnectionStatus, error?: string) {
    this.status = status;
    this.errorMessage = error || null;
    this.onStatusChange(status, this.errorMessage || undefined);
  }
}



