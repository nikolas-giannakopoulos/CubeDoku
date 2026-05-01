// CellDTO.cs
// Data transfer object for sending cell data from the server to the client
// Used in the StartResponse to send the initial puzzle clues
//
// The frontend uses face/row/col to identify cells rather than a flat index
// because that's how the 3D cube viewer organizes them internally
// (each face has its own 3x3 grid in the Three.js scene)

namespace CubeDoku.Server.Models
{
    public class CellDTO
    {
        public string Face { get; set; }   // e.g. "Front", "Back", "Top", etc
        public int Row { get; set;}
        public int Column { get; set; }
        public int Value { get; set; }     // 1-9 (locked cells are always non-zero)
    }
}