import SpotifyWebApi from "spotify-web-api-node";

export const getPublicPlaylist = async (
  spotifyApi: SpotifyWebApi,
  playlistUrl: string
) => {
  try {
    const playlistId = extractPlaylistId(playlistUrl);
    const response = await spotifyApi.getPlaylist(playlistId);
    return response.body;
  } catch (error) {
    console.error("Error fetching public playlist:", error);
    throw error;
  }
};

function extractPlaylistId(url: string): string {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error("Invalid playlist URL");
  }
  return match[1];
}
