import SpotifyWebApi from "spotify-web-api-node";

export async function createNewPlaylist(
  spotifyApi: SpotifyWebApi,
  playlistName: string,
  playlistDesc: string
): Promise<SpotifyApi.CreatePlaylistResponse> {
  try {
    const response = await spotifyApi.createPlaylist(playlistName, {
      collaborative: false,
      public: false,
      description: playlistDesc,
    });

    return response.body;
  } catch (error) {
    console.error("Error creating playlist:", error);
    throw error;
  }
}
