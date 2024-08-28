import { serve } from "@hono/node-server";
import { Hono } from "hono";
import SpotifyWebApi from "spotify-web-api-node";
import { getPublicPlaylist } from "./playlist/get-playlists";
import dotenv from "dotenv";
import { refreshAccessToken } from "./auth/refresh-token";
import { getTrackDetails } from "./track/get-track-details";
import { Context } from "hono";
import { addTrackToPlaylist } from "./track/add-track-to-playlist";
import { createNewPlaylist } from "./playlist/create-playlist";

dotenv.config();

const app = new Hono();

// Simple in-memory cache
const cache: { [key: string]: any } = {};

async function setupSpotifyApi(c: Context): Promise<SpotifyWebApi> {
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

async function rateLimitedRequest<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  if (cache[key]) {
    return cache[key] as T;
  }
  const data = await rateLimitedRequest(fetchFn);
  cache[key] = data;
  return data;
}

app.get("/", (c: Context) => {
  return c.text("Hello Hono!");
});

app.post("/playlist/genres", async (c: Context) => {
  const genres: string[] = [];
  const readTracks: string[] = [];

  try {
    const spotifyApi = await setupSpotifyApi(c);
    const { playlistUrl } = await c.req.json();

    const playlist = await getPublicPlaylist(spotifyApi, playlistUrl);
    const tracks = playlist.tracks.items;

    for (const track of tracks) {
      if (track.track) {
        const trackDetails = await getCachedOrFetch(
          `track:${track.track.id}`,
          () => getTrackDetails(track?.track?.id ?? "", spotifyApi)
        );

        console.log("Track details:", trackDetails);

        const trackGenres = trackDetails.genres;

        if (trackGenres && trackGenres.length > 0) {
          trackGenres.forEach(
            (genre) => !genres.includes(genre) && genres.push(genre)
          );
          readTracks.push(trackDetails.name);
        } else {
          console.log(`No genres found for track: ${trackDetails.name}`);
        }
      } else {
        console.log("Skipping null track");
      }
    }
  } catch (error) {
    console.error(`Error in /playlist/genres: ${error}`);
    return c.json({ error: "Failed to fetch playlist genres" }, 500);
  }

  console.log("Final genres:", Array.from(genres));
  console.log("Read tracks:", Array.from(readTracks));

  return c.json({
    readTracks: Array.from(readTracks),
    genres: Array.from(genres),
  });
});

app.post("/playlist/filter", async (c: Context) => {
  try {
    const spotifyApi = await setupSpotifyApi(c);
    const { playlistUrl, genres } = await c.req.json();

    const playlist = await getPublicPlaylist(spotifyApi, playlistUrl);
    const tracks = playlist.tracks.items;

    const filteredTracks = await Promise.all(
      tracks.map(async (track) => {
        if (!track.track) return null;

        const trackDetails = await getCachedOrFetch(
          `track:${track.track.id}`,
          () => getTrackDetails(track?.track?.id ?? "", spotifyApi)
        );

        const trackGenres = trackDetails.genres || [];

        const matchesGenre = genres.some((genre: string) =>
          trackGenres.some((trackGenre) =>
            trackGenre.toLowerCase().includes(genre.toLowerCase())
          )
        );

        return matchesGenre
          ? {
              id: track.track.id,
              name: track.track.name,
            }
          : null;
      })
    );

    const validFilteredTracks = filteredTracks.filter(Boolean);

    return c.json({
      filteredTracks: validFilteredTracks,
      totalTracks: tracks.length,
      matchingTracks: validFilteredTracks.length,
    });
  } catch (error) {
    console.error(`Error in /playlist/filter: ${error}`);
    return c.json({ error: "Failed to filter playlist" }, 500);
  }
});

app.post("/playlist/create-filtered", async (c: Context) => {
  try {
    const spotifyApi = await setupSpotifyApi(c);

    const { playlistUrl, genres, playlistName } = await c.req.json();

    const playlist = await getPublicPlaylist(spotifyApi, playlistUrl);

    const tracks = playlist.tracks.items;

    const filteredTracks = await Promise.all(
      tracks.map(async (track) => {
        if (!track.track) return null;

        const trackDetails = await getCachedOrFetch(
          `track:${track.track.id}`,
          () => getTrackDetails(track?.track?.id ?? "", spotifyApi)
        );

        const trackGenres = trackDetails.genres || [];

        const matchesGenre = genres.some((genre: string) =>
          trackGenres.some((trackGenre) =>
            trackGenre.toLowerCase().includes(genre.toLowerCase())
          )
        );

        return matchesGenre
          ? {
              uri: track.track.uri,
              name: track.track.name,
            }
          : null;
      })
    );

    const validFilteredTracks = filteredTracks.filter(Boolean);
    const trackUris = validFilteredTracks.map((t) => t!.uri);

    const newPlaylist = await createNewPlaylist(
      spotifyApi,
      playlistName,
      "Playlist created using spotify-playlists.vercel.app by @ducaswtf"
    );

    if (newPlaylist) {
      await spotifyApi.addTracksToPlaylist(newPlaylist.id, trackUris);

      console.log(
        `${validFilteredTracks.length} tracks added to playlist ${playlistName}`
      );
    } else {
      return c.json(
        { error: true, message: "Error while creating playlist" },
        500
      );
    }

    return c.json({ playlist: newPlaylist, tracks: validFilteredTracks });
  } catch (error) {
    console.error("Error in /playlist/create-filtered:", error);
    return c.json(
      {
        error: true,
        message: "An error occurred while processing your request",
      },
      500
    );
  }
});

app.get("/login", (c: Context) => {
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
  });

  const scopes = [
    "user-read-private",
    "user-read-email",
    "playlist-read-private",
    "playlist-modify-public",
    "playlist-modify-private",
  ];
  const state = "some-state-of-my-choice";
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
  return c.redirect(authorizeURL);
});

app.get("/callback", async (c: Context) => {
  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: "Authorization code not found" }, 400);
  }

  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
  });

  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = data.body;

    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    return c.json({
      message: "Authentication successful",
      access_token,
      refresh_token,
      expires_in,
    });
  } catch (error) {
    return c.json({ error: "Failed to authenticate" }, 500);
  }
});

const port = 8080;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
