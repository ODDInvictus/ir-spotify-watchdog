import { AccessToken } from '@spotify/web-api-ts-sdk/dist/mjs/types';
import db from './db';
import { set } from 'zod';

type AccessTokenCreate = AccessToken & {
  scope: string
}

type AccessTokenPlus = AccessTokenCreate & {
  expires_at: number
}

export function getAcccesToken(): AccessTokenPlus | undefined {

  const stmt = db.prepare(`SELECT * FROM token WHERE id = 1;`)
  const token = stmt.get()

  return token as AccessTokenPlus | undefined
}

export function setAccessToken(token: AccessTokenCreate) {
  const expires_at = Date.now() + token.expires_in * 1000
  db.exec(`
    INSERT OR REPLACE 
    INTO token(id, access_token, token_type, expires_in, expires_at, refresh_token, scope)
    VALUES(1, '${token.access_token}', '${token.token_type}', '${token.expires_in}', '${expires_at}', '${token.refresh_token}', '${token.scope}')
  `)
}

export function updateToken(token: string) {
  const expires_at = Date.now() + 3600 * 1000
  db.exec(`
    UPDATE token
    SET access_token = '${token}', expires_at = '${expires_at}'
  `)
}

export async function refreshToken(token: AccessTokenPlus) {
  const res = await fetch(`https://accounts.spotify.com/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    }).toString()
  }).then(res => res.json())

  if (res.error) {
    throw new Error(res.error)
  }

  updateToken(res.access_token)

  return res
}