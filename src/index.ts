import { SpotifyApi } from '@spotify/web-api-ts-sdk'
import { config } from 'dotenv'
import express from 'express'
import { getAcccesToken, refreshToken, setAccessToken } from './spotify'
import { graphqlHTTP } from 'express-graphql'
import { buildSchema } from 'graphql'
import { readFileSync } from 'fs';
import { generateRandomString } from './utils'

/*
  DOTENV
*/
console.log('Starting Spotify Watchdog')
config()

/*
  EXPRESS (for spotify auth)
*/
const app = express()
app.set('view engine', 'pug')
app.use(express.static('public'))

const token = getAcccesToken()
let sdk: SpotifyApi | undefined
if (token) {
  sdk = SpotifyApi.withAccessToken(process.env.CLIENT_ID!, token, {
    fetch: async (url, options) => {
      if (!options) {
        throw new Error('No options defined')
      }

      const token = getAcccesToken()

      let opts = {

      }

      if (token && token.expires_at < Date.now()) {
        // Refresh token
        const t = await refreshToken(token)
        const new_token = t.access_token
        opts = {
          'Authorization': 'Bearer ' + new_token
        }
      }

      return await fetch(url, Object.assign(options, opts))
    }
  })
}

/*
  GRAPHQL
*/
const schema = buildSchema(readFileSync('./src/schema.graphql', 'utf-8'))

const root = {
  playbackState: async () => {
    return await sdk?.player.getPlaybackState()
  },
  getQueue: async () => {
    return await sdk?.player.getUsersQueue()
  },
  enqueueTrack: async ({ input }: { input: any }) => {
    const res = await sdk?.player.addItemToPlaybackQueue(`spotify:track:${input.trackId}`)

    if (res) {
      console.error(res)
    }

    return !!res
  }
}


/*
  ROUTES
*/
app.get('/', async (req, res) => {
  const state = await sdk?.player.getPlaybackState()
  res.render('index', { state })
})

app.get('/login', async (req, res) => {

  const state = generateRandomString(16)
  const scope = 'user-read-playback-state user-modify-playback-state user-read-currently-playing'

  res.redirect('https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: process.env.CLIENT_ID!,
      scope,
      state,
      redirect_uri: process.env.CALLBACK || 'http://localhost:8080/callback/'
    }).toString())
})

app.get('/callback', async (req, res) => {

  const code = req.query.code as string
  const state = req.query.state as string

  if (code === undefined || state === undefined) {
    res.redirect('/#' +
      new URLSearchParams({
        error: 'invalid_response'
      }).toString()
    )
  }

  if (state === null) {
    res.redirect('/#' +
      new URLSearchParams({
        error: 'state_mismatch'
      }).toString()
    )
  } else {
    const body = new URLSearchParams({
      code: code,
      redirect_uri: process.env.CALLBACK || 'http://localhost:8080/callback/',
      grant_type: 'authorization_code'
    })

    const spotifyRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(process.env.CLIENT_ID! + ':' + process.env.CLIENT_SECRET!).toString('base64'))
      },
      body: body.toString(),
    }).then(spotifyRes => spotifyRes.json())

    setAccessToken(spotifyRes)
    sdk = SpotifyApi.withAccessToken(process.env.CLIENT_ID!, spotifyRes, {})

    res.redirect('/')
  }
})

app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}))

app.listen(process.env.PORT || 8080, () => {
  console.log('Listening on port 8080')
})