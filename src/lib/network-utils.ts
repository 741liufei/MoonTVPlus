/* eslint-disable no-console */

/**
 * 获取系统的局域网IP地址
 */
export async function getLocalNetworkIP(): Promise<string | null> {
  if (typeof window === 'undefined') {
    // 服务端：使用 Node.js 的 os 模块
    try {
      const os = await import('os');
      const interfaces = os.networkInterfaces();

      // 优先级：以太网 > WiFi > 其他
      const priorityOrder = ['以太网', 'Ethernet', 'eth0', 'WLAN', 'Wi-Fi', 'wlan0', 'en0'];

      // 先按优先级查找
      for (const name of priorityOrder) {
        const iface = interfaces[name];
        if (iface) {
          for (const addr of iface) {
            // 只返回 IPv4 地址，排除内部地址
            if (addr.family === 'IPv4' && !addr.internal) {
              console.log(`找到局域网IP: ${addr.address} (接口: ${name})`);
              return addr.address;
            }
          }
        }
      }

      // 如果没找到，遍历所有接口
      for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (iface) {
          for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
              console.log(`找到局域网IP: ${addr.address} (接口: ${name})`);
              return addr.address;
            }
          }
        }
      }

      console.warn('未找到局域网IP地址');
      return null;
    } catch (error) {
      console.error('获取局域网IP失败:', error);
      return null;
    }
  } else {
    // 客户端：使用 WebRTC 获取本地IP
    return getLocalIPViaWebRTC();
  }
}

/**
 * 通过 WebRTC 获取本地IP（客户端）
 */
function getLocalIPViaWebRTC(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: []
      });

      pc.createDataChannel('');

      pc.createOffer().then((offer) => pc.setLocalDescription(offer));

      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) {
          return;
        }

        const candidate = ice.candidate.candidate;
        const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/;
        const match = ipRegex.exec(candidate);

        if (match) {
          const ip = match[0];
          // 排除回环地址
          if (!ip.startsWith('127.')) {
            console.log(`通过WebRTC找到本地IP: ${ip}`);
            pc.close();
            resolve(ip);
          }
        }
      };

      // 超时处理
      setTimeout(() => {
        pc.close();
        resolve(null);
      }, 2000);
    } catch (error) {
      console.error('WebRTC获取IP失败:', error);
      resolve(null);
    }
  });
}

/**
 * 获取公网IP地址
 */
export async function getPublicIP(): Promise<string | null> {
  try {
    // 使用多个服务作为备选
    const services = [
      'https://api.ipify.org?format=json',
      'https://api.ip.sb/ip',
      'https://ifconfig.me/ip',
    ];

    for (const service of services) {
      try {
        const response = await fetch(service, {
          signal: AbortSignal.timeout(3000)
        });

        if (response.ok) {
          const text = await response.text();
          // 尝试解析JSON
          try {
            const json = JSON.parse(text);
            if (json.ip) {
              console.log(`获取到公网IP: ${json.ip}`);
              return json.ip;
            }
          } catch {
            // 如果不是JSON，直接返回文本
            const ip = text.trim();
            if (ip && /^[0-9.]+$/.test(ip)) {
              console.log(`获取到公网IP: ${ip}`);
              return ip;
            }
          }
        }
      } catch (error) {
        console.warn(`从 ${service} 获取公网IP失败:`, error);
        continue;
      }
    }

    console.warn('所有公网IP服务都失败了');
    return null;
  } catch (error) {
    console.error('获取公网IP失败:', error);
    return null;
  }
}

/**
 * 智能获取最佳访问地址
 * 优先级：环境变量 > 数据库配置 > 客户端传来的地址
 */
export async function getBestAccessURL(
  currentOrigin?: string,
  port?: number,
  dbSiteBase?: string
): Promise<string> {
  // 1. 优先使用环境变量配置的地址
  if (typeof window === 'undefined') {
    const siteBase = process.env.SITE_BASE;
    if (siteBase) {
      console.log(`使用环境变量配置的地址: ${siteBase}`);
      return siteBase;
    }

    // 2. 使用数据库配置的地址
    if (dbSiteBase) {
      console.log(`使用数据库配置的地址: ${dbSiteBase}`);
      return dbSiteBase;
    }

    // Docker 环境中无法自动获取宿主机IP，使用客户端传来的地址
    console.log('Docker 环境：使用客户端传来的地址');
  }

  // 3. 使用客户端传来的地址
  if (currentOrigin) {
    console.log(`使用客户端地址: ${currentOrigin}`);
    return currentOrigin;
  }

  // 4. 最后的回退
  if (typeof window !== 'undefined') {
    console.log(`使用浏览器当前地址: ${window.location.origin}`);
    return window.location.origin;
  }

  console.warn('无法确定访问地址，使用默认值');
  return 'http://localhost:3000';
}

/**
 * 检测是否在局域网环境
 */
export function isLocalNetwork(hostname: string): boolean {
  // 检查是否是本地地址
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }

  // 检查是否是局域网IP
  const localPatterns = [
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  ];

  return localPatterns.some(pattern => pattern.test(hostname));
}
