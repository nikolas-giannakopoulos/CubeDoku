// CubeTopology.cs
// This is basically a hard-coded lookup table of which cells are "adjacent" on the cube
// i.e. which cells share a physical edge or corner
//
// I derived these by hand by drawing the cube on paper and mapping out which face-cells
// touch which other face-cells. It took a while to get right. The orientation I'm using:
//   Front face is "facing you", Back is opposite, Top is up, Bottom is down, Left/Right as expected
//
// Edges: 12 pairs (one cell from each of two adjacent faces that share an edge)
// Corners: 8 triples (one cell from each of three faces that meet at a corner)
//
// These are used by both the Checkers (to validate sums) and the LogicalSolver (to
// deduce values based on the 12-sum rule)
//
// TODO: maybe add a unit test that verifies each cell appears in exactly the right number
// of edge/corner groups? For now I manually verified it but tests would be better.

namespace CubeDoku.Server.Core{
    public static class CubeTopology
    {
        // Each entry is a pair: [face1-cell, face2-cell] that share an edge
        // The 12-sum rule requires these two cells to sum to 12
        public static readonly List<CellPosition[]> Edges = new List<CellPosition[]>
        {
            // Front-Top shared edge (top row of Front, bottom row of Top)
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 0, 1), 
                new CellPosition(CubeFaces.Top, 2, 1) 
            },

            // Front-Right shared edge
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 1, 2), 
                new CellPosition(CubeFaces.Right, 1, 0) 
            },

            // Front-Left shared edge
            new CellPosition[]
            {
                new CellPosition(CubeFaces.Front, 1, 0),
                new CellPosition(CubeFaces.Left, 1, 2)
            },

            // Front-Bottom shared edge
            new CellPosition[]
            {
                new CellPosition(CubeFaces.Front, 2, 1),
                new CellPosition(CubeFaces.Bottom, 0, 1)
            },

            // Top-Right shared edge
            new CellPosition[]
            {
                new CellPosition(CubeFaces.Top, 1 , 2),
                new CellPosition(CubeFaces.Right, 0 , 1)
            },

            // Top-Left shared edge
            new CellPosition[]
            {
                new CellPosition(CubeFaces.Top, 1 , 0),
                new CellPosition(CubeFaces.Left, 0 , 1)
            },

            // Top-Back shared edge
            new CellPosition[]
            {
                new CellPosition(CubeFaces.Top, 0 , 1),
                new CellPosition(CubeFaces.Back, 0 , 1)
            },

            // Left-Back shared edge
            new CellPosition[]
            {
                new CellPosition(CubeFaces.Left, 1 , 0),
                new CellPosition(CubeFaces.Back, 1 , 2)
            },

            // Right-Back shared edge
            new CellPosition[]
            {
                new CellPosition(CubeFaces.Right, 1, 2),
                new CellPosition(CubeFaces.Back, 1, 0)
            },

            // Left-Bottom shared edge
            new CellPosition[]
            {
                new CellPosition(CubeFaces.Left, 2 , 1),
                new CellPosition(CubeFaces.Bottom, 1, 0)
            },

            // Right-Bottom shared edge
            new CellPosition[]
            {
                new CellPosition(CubeFaces.Right, 2 , 1),
                new CellPosition(CubeFaces.Bottom, 1, 2)
            },

            // Back-Bottom shared edge
            new CellPosition[]
            {
                new CellPosition(CubeFaces.Back, 2, 1),
                new CellPosition(CubeFaces.Bottom, 2, 1)
            },
        };
    
        // Each entry is a triple: [face1-cell, face2-cell, face3-cell] that meet at a corner
        // These three cells must also sum to 12
        // A cube has 8 corners - I verified all 8 are here
        public static readonly List<CellPosition[]> Corners = new List<CellPosition[]>
        {
            // Front-Top-Right corner
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 0, 2),
                new CellPosition(CubeFaces.Top, 2, 2),
                new CellPosition(CubeFaces.Right, 0, 0)
            },

            // Front-Top-Left corner
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 0, 0),
                new CellPosition(CubeFaces.Top, 2, 0),
                new CellPosition(CubeFaces.Left, 0, 2)
            },

            // Front-Bottom-Left corner
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 2, 0),
                new CellPosition(CubeFaces.Left, 2, 2),
                new CellPosition(CubeFaces.Bottom, 0, 0)
            },

            // Front-Bottom-Right corner
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 2, 2),
                new CellPosition(CubeFaces.Right,  2, 0),
                new CellPosition(CubeFaces.Bottom, 0, 2)
            },

            // Back-Top-Left corner
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Top, 0, 0),
                new CellPosition(CubeFaces.Left, 0, 0),
                new CellPosition(CubeFaces.Back, 0, 2)
            },

            // Back-Top-Right corner
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Top, 0, 2),
                new CellPosition(CubeFaces.Right, 0, 2),
                new CellPosition(CubeFaces.Back, 0, 0)
            },

            // Back-Bottom-Right corner
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Right, 2, 2),
                new CellPosition(CubeFaces.Back, 2, 0),
                new CellPosition(CubeFaces.Bottom, 2, 2)
            },

            // Back-Bottom-Left corner
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Left, 2, 0),
                new CellPosition(CubeFaces.Bottom, 2, 0),
                new CellPosition(CubeFaces.Back, 2, 2)
            },
        };
    }
}