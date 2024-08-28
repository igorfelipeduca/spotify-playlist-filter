import SpotifyWebApi from "spotify-web-api-node";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getTrackDetails(
  trackId: string,
  spotifyApi: SpotifyWebApi
) {
  try {
    const trackData = await spotifyApi.getTrack(trackId);
    const artistId = trackData.body.artists[0].id;
    const artistData = await spotifyApi.getArtist(artistId);

    const trackWithGenre = {
      id: trackData.body.id,
      name: trackData.body.name,
      artists: trackData.body.artists.map((artist) => artist.name),
      genres: artistData.body.genres,
    };

    return trackWithGenre;
  } catch (error: any) {
    if (error.statusCode === 429) {
      const retryAfter = parseInt(error.headers["retry-after"]) || 1;
      console.log(`Rate limited. Retrying after ${retryAfter} seconds.`);
      await delay(retryAfter * 1000);
      return getTrackDetails(trackId, spotifyApi);
    }
    console.error("Error getting track details:", error);
    throw error;
  }
}
