// CubeFaces.cs
// The 6 faces of a standard cube - Front/Back/Top/Bottom/Left/Right
// These are cast to int indices when we access the 3D cellList array in Cube.cs
// I had to be careful about which direction "Left" and "Right" face because
// depending on how you orient the cube visually it could mean different things.
// Spent a whole afternoon debugging the topology table because of this...

namespace CubeDoku.Server.Core
{
    public enum CubeFaces 
    {
        Front,   // 0
        Back,    // 1
        Top,     // 2
        Bottom,  // 3
        Left,    // 4
        Right    // 5
    }
}