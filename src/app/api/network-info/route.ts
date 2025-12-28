/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getBestAccessURL, getLocalNetworkIP, getPublicIP } from '@/lib/network-utils';

export const runtime = 'nodejs';

/**
 * 获取网络信息
 */
export async function GET(request: NextRequest) {
  // 验证用户登录
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // 获取各种IP信息
    const localIP = await getLocalNetworkIP();
    const publicIP = await getPublicIP();
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

    // 获取数据库配置中的 SiteBase
    const config = await getConfig();
    const dbSiteBase = config?.SiteConfig?.SiteBase;

    const bestURL = await getBestAccessURL(request.nextUrl.origin, port, dbSiteBase);

    // 获取环境变量配置
    const siteBase = process.env.SITE_BASE;

    return NextResponse.json(
      {
        localIP,
        publicIP,
        port,
        bestURL,
        siteBase,
        dbSiteBase,
        currentOrigin: request.nextUrl.origin,
        recommendation: getRecommendation(localIP, publicIP, siteBase, dbSiteBase),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('获取网络信息失败:', error);
    return NextResponse.json(
      {
        error: '获取网络信息失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * 生成访问建议
 */
function getRecommendation(
  localIP: string | null,
  publicIP: string | null,
  siteBase: string | undefined,
  dbSiteBase: string | undefined
): string {
  if (siteBase) {
    return `✅ 已配置环境变量 SITE_BASE，订阅链接将使用: ${siteBase}`;
  }

  if (dbSiteBase) {
    return `✅ 已在系统管理中配置 SITE_BASE，订阅链接将使用: ${dbSiteBase}`;
  }

  // Docker 环境检测：如果 localIP 是 172.x.x.x，说明在容器内
  if (localIP && localIP.startsWith('172.')) {
    return `⚠️ 检测到 Docker 容器环境 (${localIP})，请在系统管理 → 站点配置中设置"站点访问地址"，或在 .env 文件中配置 SITE_BASE 为宿主机IP，例如: http://192.168.31.114:3000`;
  }

  if (localIP && localIP.startsWith('192.168.')) {
    return `✅ 检测到局域网IP: ${localIP}，局域网设备可直接访问`;
  }

  if (publicIP) {
    return `检测到公网IP: ${publicIP}，如需外网访问请配置端口转发和 SITE_BASE`;
  }

  return '⚠️ 建议在系统管理 → 站点配置中设置"站点访问地址"，或在 .env 文件中配置 SITE_BASE 环境变量';
}
