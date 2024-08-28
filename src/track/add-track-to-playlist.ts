import SpotifyWebApi from "spotify-web-api-node";

export async function addTrackToPlaylist(
  spotifyApi: SpotifyWebApi,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  await spotifyApi.addTracksToPlaylist(playlistId, trackUris);
}
