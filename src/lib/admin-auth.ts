/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from './auth';
import { getConfig } from './config';
import { db } from './db';

/**
 * 检查用户是否有管理员权限（owner 或 admin）
 * @param request NextRequest 对象
 * @returns 如果有权限返回用户信息，否则返回错误响应
 */
export async function checkAdminPermission(request: NextRequest): Promise<
  | {
    success: true;
    username: string;
    role: 'owner' | 'admin';
  }
  | {
    success: false;
    response: NextResponse;
  }
> {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  // localstorage 模式不支持用户管理
  if (storageType === 'localstorage') {
    return {
      success: false,
      response: NextResponse.json(
        { error: '不支持本地存储进行管理员操作' },
        { status: 400 }
      ),
    };
  }

  // 获取认证信息
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return {
      success: false,
      response: NextResponse.json({ error: '未授权' }, { status: 401 }),
    };
  }

  const username = authInfo.username;

  // 检查是否是站长
  if (username === process.env.USERNAME) {
    return {
      success: true,
      username,
      role: 'owner',
    };
  }

  // 检查是否是管理员
  try {
    // 优先从新版本获取用户信息
    const userInfo = await db.getUserInfoV2(username);
    if (userInfo) {
      if (userInfo.role === 'admin' && !userInfo.banned) {
        return {
          success: true,
          username,
          role: 'admin',
        };
      }
      // 用户被封禁或不是管理员
      return {
        success: false,
        response: NextResponse.json({ error: '权限不足' }, { status: 403 }),
      };
    }

    // 回退到配置中查找
    const config = await getConfig();
    const user = config.UserConfig.Users.find((u) => u.username === username);
    if (user && user.role === 'admin' && !user.banned) {
      return {
        success: true,
        username,
        role: 'admin',
      };
    }

    return {
      success: false,
      response: NextResponse.json({ error: '权限不足' }, { status: 403 }),
    };
  } catch (error) {
    console.error('权限检查失败:', error);
    return {
      success: false,
      response: NextResponse.json(
        { error: '服务器错误' },
        { status: 500 }
      ),
    };
  }
}

/**
 * 检查用户是否是站长（owner）
 * @param request NextRequest 对象
 * @returns 如果是站长返回用户信息，否则返回错误响应
 */
export async function checkOwnerPermission(request: NextRequest): Promise<
  | {
    success: true;
    username: string;
  }
  | {
    success: false;
    response: NextResponse;
  }
> {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return {
      success: false,
      response: NextResponse.json({ error: '未授权' }, { status: 401 }),
    };
  }

  const username = authInfo.username;

  // 检查是否是站长
  if (username === process.env.USERNAME) {
    return {
      success: true,
      username,
    };
  }

  return {
    success: false,
    response: NextResponse.json(
      { error: '仅站长可执行此操作' },
      { status: 403 }
    ),
  };
}
