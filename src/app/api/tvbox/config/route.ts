import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { getBestAccessURL } from '@/lib/network-utils';

export const runtime = 'nodejs';

/**
 * 获取TVBOX订阅配置
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

  // 检查是否开启订阅功能
  const enableSubscribe = process.env.ENABLE_TVBOX_SUBSCRIBE === 'true';
  const subscribeToken = process.env.TVBOX_SUBSCRIBE_TOKEN;

  if (!enableSubscribe || !subscribeToken) {
    return NextResponse.json(
      {
        enabled: false,
        url: '',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // 构建订阅链接
  const searchParams = request.nextUrl.searchParams;
  const clientOrigin = searchParams.get('origin');
  const adFilter = searchParams.get('adFilter') === 'true'; // 获取去广告参数

  // 获取数据库配置中的 SiteBase
  const config = await getConfig();
  const dbSiteBase = config?.SiteConfig?.SiteBase;

  // 智能获取最佳访问地址
  // 优先级：SITE_BASE 环境变量 > 数据库配置 > 客户端传来的origin
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const baseUrl = await getBestAccessURL(clientOrigin || request.nextUrl.origin, port, dbSiteBase);

  // 构建订阅链接，包含 adFilter 参数
  const subscribeUrl = `${baseUrl}/api/tvbox/subscribe?token=${encodeURIComponent(subscribeToken)}&adFilter=${adFilter}`;

  return NextResponse.json(
    {
      enabled: true,
      url: subscribeUrl,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
