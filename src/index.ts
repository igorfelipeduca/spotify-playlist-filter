import { serve } from "@hono/node-server";
import { Hono } from "hono";
import SpotifyWebApi from "spotify-web-api-node";
import { getPublicPlaylist } from "./playlist/get-playlists";
import dotenv from "dotenv";
import { refreshAccessToken } from "./auth/refresh-token";

dotenv.config();

const app = new Hono();

async function setupSpotifyApi(c: any) {
  const refreshToken = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!refreshToken) {
    throw new Error("No refresh token provided");
  }

  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    refreshToken: refreshToken,
  });

  const data = await refreshAccessToken(spotifyApi);
  spotifyApi.setAccessToken(data.access_token);

  return spotifyApi;
}

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/playlist/genres", async (c) => {
  try {
    const spotifyApi = await setupSpotifyApi(c);
    const { playlistUrl } = await c.req.json();

    const playlist = await getPublicPlaylist(spotifyApi, playlistUrl);
    const tracks = playlist.tracks.items;

    const genres = new Set<string>();

    await Promise.all(
      tracks.map(async (track) => {
        if (track.track && track.track.album) {
          const albumId = track.track.album.id;
          const albumDetails = await spotifyApi.getAlbum(albumId);
          const albumGenres = albumDetails.body.genres || [];
          albumGenres.forEach((genre) => genres.add(genre));
        }
      })
    );

    return c.json({ genres: Array.from(genres) });
  } catch (error) {
    console.error("Error fetching playlist genres:", error);
    return c.json({ error: "Failed to fetch playlist genres" }, 500);
  }
});

app.post("/playlist/filter", async (c) => {
  try {
    const spotifyApi = await setupSpotifyApi(c);
    const { playlistUrl, genres } = await c.req.json();

    const playlist = await getPublicPlaylist(spotifyApi, playlistUrl);
    const tracks = playlist.tracks.items;

    const filteredTracks = await Promise.all(
      tracks.map(async (track) => {
        if (!track.track || !track.track.album) return false;

        const albumId = track.track.album.id;
        const albumDetails = await spotifyApi.getAlbum(albumId);
        const trackGenres = albumDetails.body.genres || [];

        return genres.some((genre: string) =>
          trackGenres.some((trackGenre) =>
            trackGenre.toLowerCase().includes(genre.toLowerCase())
          )
        );
      })
    );

    return c.json({ filteredTracks: filteredTracks.filter(Boolean) });
  } catch (error) {
    console.error("Error filtering playlist:", error);
    return c.json({ error: "Failed to filter playlist" }, 500);
  }
});

app.get("/login", (c) => {
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
  });

  const scopes = [
    "user-read-private",
    "user-read-email",
    "playlist-read-private",
  ];
  const state = "some-state-of-my-choice";
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
  return c.redirect(authorizeURL);
});

const port = 8080;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
