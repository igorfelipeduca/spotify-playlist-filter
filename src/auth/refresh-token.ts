import SpotifyWebApi from "spotify-web-api-node";

export async function refreshAccessToken(
  spotifyApi: SpotifyWebApi
): Promise<{ access_token: string }> {
  try {
    const data = await spotifyApi.refreshAccessToken();
    return { access_token: data.body["access_token"] };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw error;
  }
}
