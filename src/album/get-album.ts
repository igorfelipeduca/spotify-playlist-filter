import SpotifyWebApi from "spotify-web-api-node";

export async function getAlbum(albumId: string, spotifyApi: SpotifyWebApi) {
  try {
    const data = await spotifyApi.getAlbum(albumId);
    return {
      id: data.body.id,
      name: data.body.name,
      artists: data.body.artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
      })),
      releaseDate: data.body.release_date,
      totalTracks: data.body.total_tracks,
      images: data.body.images,
      genres: data.body.genres,
    };
  } catch (error) {
    console.error("Error fetching album:", error);
    throw error;
  }
}
