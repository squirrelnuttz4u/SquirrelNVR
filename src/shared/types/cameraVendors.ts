// Camera vendor presets and configurations

export interface CameraVendorPreset {
  vendor: string;
  model?: string;
  streamType: string;
  defaultPort: number;
  streamPath: string;
  subStreamPath?: string;
  requiresAuth: boolean;
  supportsOnvif: boolean;
  onvifPort?: number;
  notes?: string;
}

export const CAMERA_VENDOR_PRESETS: CameraVendorPreset[] = [
  // Reolink Cameras
  {
    vendor: 'Reolink',
    model: 'RLC-410/420/511/520',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/h264Preview_01_main',
    subStreamPath: '/h264Preview_01_sub',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 8000,
    notes: 'Main stream: high quality, Sub stream: lower quality for preview'
  },
  {
    vendor: 'Reolink',
    model: 'RLC-810A/811A/820A/822A',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/Preview_01_main',
    subStreamPath: '/Preview_01_sub',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 8000,
    notes: '4K cameras - use sub stream for better performance'
  },
  {
    vendor: 'Reolink',
    model: 'E1 Pro/E1 Zoom',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/h264Preview_01_main',
    subStreamPath: '/h264Preview_01_sub',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 8000,
    notes: 'PTZ indoor cameras'
  },

  // Hikvision Cameras
  {
    vendor: 'Hikvision',
    model: 'DS-2CD2xxx',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/Streaming/Channels/101',
    subStreamPath: '/Streaming/Channels/102',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 80,
    notes: 'Channel 101: main stream, 102: sub stream, 103: third stream'
  },
  {
    vendor: 'Hikvision',
    model: 'Generic',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/ISAPI/Streaming/Channels/101',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 80,
    notes: 'Alternative ISAPI path'
  },

  // Dahua Cameras
  {
    vendor: 'Dahua',
    model: 'IPC-HDW/HFW',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/cam/realmonitor?channel=1&subtype=0',
    subStreamPath: '/cam/realmonitor?channel=1&subtype=1',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 80,
    notes: 'subtype=0: main stream, subtype=1: sub stream'
  },

  // Amcrest Cameras (Dahua OEM)
  {
    vendor: 'Amcrest',
    model: 'IP2M/IP3M/IP4M',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/cam/realmonitor?channel=1&subtype=0',
    subStreamPath: '/cam/realmonitor?channel=1&subtype=1',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 80,
    notes: 'Dahua-based cameras'
  },

  // Axis Communications
  {
    vendor: 'Axis',
    model: 'M-Series/P-Series',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/axis-media/media.amp',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 80,
    notes: 'High-end professional cameras'
  },
  {
    vendor: 'Axis',
    model: 'Generic H.264',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/axis-media/media.amp?videocodec=h264',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 80,
    notes: 'Specify codec explicitly'
  },

  // Ubiquiti UniFi Protect
  {
    vendor: 'Ubiquiti',
    model: 'UniFi Protect',
    streamType: 'rtsp',
    defaultPort: 7447,
    streamPath: '/{camera-id}',
    requiresAuth: true,
    supportsOnvif: false,
    notes: 'Replace {camera-id} with actual camera ID from UniFi console'
  },

  // TP-Link Tapo
  {
    vendor: 'TP-Link',
    model: 'Tapo C200/C210',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/stream1',
    subStreamPath: '/stream2',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 2020,
    notes: 'stream1: HD, stream2: SD'
  },

  // Wyze Cam (with RTSP firmware)
  {
    vendor: 'Wyze',
    model: 'Cam v2/v3 (RTSP)',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/live',
    requiresAuth: true,
    supportsOnvif: false,
    notes: 'Requires RTSP firmware installation'
  },

  // Foscam
  {
    vendor: 'Foscam',
    model: 'FI9800P/FI9900P',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/videoMain',
    subStreamPath: '/videoSub',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 888,
    notes: 'videoMain: high quality, videoSub: low quality'
  },

  // Lorex (Dahua OEM)
  {
    vendor: 'Lorex',
    model: 'LNB/LNC Series',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/cam/realmonitor?channel=1&subtype=0',
    subStreamPath: '/cam/realmonitor?channel=1&subtype=1',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 80,
    notes: 'Dahua-based cameras'
  },

  // D-Link
  {
    vendor: 'D-Link',
    model: 'DCS-Series',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/live1.sdp',
    subStreamPath: '/live2.sdp',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 80,
    notes: 'live1: main stream, live2: sub stream'
  },

  // Annke (Hikvision OEM)
  {
    vendor: 'Annke',
    model: 'C800/I91BM',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/Streaming/Channels/101',
    subStreamPath: '/Streaming/Channels/102',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 80,
    notes: 'Hikvision-based cameras'
  },

  // Vivotek
  {
    vendor: 'Vivotek',
    model: 'IP-Series',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/live.sdp',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 80,
    notes: 'Professional surveillance cameras'
  },

  // Generic ONVIF
  {
    vendor: 'Generic',
    model: 'ONVIF Compatible',
    streamType: 'onvif',
    defaultPort: 80,
    streamPath: '/onvif/device_service',
    requiresAuth: true,
    supportsOnvif: true,
    onvifPort: 80,
    notes: 'Auto-discover streams via ONVIF'
  },

  // Generic RTSP
  {
    vendor: 'Generic',
    model: 'RTSP Camera',
    streamType: 'rtsp',
    defaultPort: 554,
    streamPath: '/stream',
    requiresAuth: false,
    supportsOnvif: false,
    notes: 'Generic RTSP configuration'
  },
];

export function buildStreamUrl(
  preset: CameraVendorPreset,
  ip: string,
  username?: string,
  password?: string,
  useSubStream: boolean = false
): string {
  const port = preset.defaultPort;
  const path = useSubStream && preset.subStreamPath ? preset.subStreamPath : preset.streamPath;

  let url = `${preset.streamType}://`;

  if (preset.requiresAuth && username && password) {
    url += `${username}:${password}@`;
  }

  url += `${ip}:${port}${path}`;

  return url;
}

export function getVendorPreset(vendor: string, model?: string): CameraVendorPreset | undefined {
  if (model) {
    return CAMERA_VENDOR_PRESETS.find(p => p.vendor === vendor && p.model === model);
  }
  return CAMERA_VENDOR_PRESETS.find(p => p.vendor === vendor);
}

export function getVendorsByName(vendor: string): CameraVendorPreset[] {
  return CAMERA_VENDOR_PRESETS.filter(p => p.vendor === vendor);
}

export function getAllVendors(): string[] {
  return [...new Set(CAMERA_VENDOR_PRESETS.map(p => p.vendor))].sort();
}
