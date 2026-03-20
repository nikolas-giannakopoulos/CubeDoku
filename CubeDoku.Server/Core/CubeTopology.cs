namespace CubeDoku.Server.Core{
    public static class CubeTopology
    {
        // List with the pairs that make edges
        public static readonly List<CellPosition[]> Edges = new List<CellPosition[]>
        {
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 0, 1), 
                new CellPosition(CubeFaces.Top, 2, 1) 
            },

            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 1, 2), 
                new CellPosition(CubeFaces.Right, 1, 0) 
            },

            new CellPosition[]
            {
                new CellPosition(CubeFaces.Front, 1, 0),
                new CellPosition(CubeFaces.Left, 1, 2)
            },

            new CellPosition[]
            {
                new CellPosition(CubeFaces.Front, 2, 1),
                new CellPosition(CubeFaces.Bottom, 0, 1)
            },

            new CellPosition[]
            {
                new CellPosition(CubeFaces.Top, 1 , 2),
                new CellPosition(CubeFaces.Right, 0 , 1)
            },

            new CellPosition[]
            {
                new CellPosition(CubeFaces.Top, 1 , 0),
                new CellPosition(CubeFaces.Left, 0 , 1)
            },

            new CellPosition[]
            {
                new CellPosition(CubeFaces.Top, 0 , 1),
                new CellPosition(CubeFaces.Back, 0 , 1)
            },

            new CellPosition[]
            {
                new CellPosition(CubeFaces.Left, 1 , 0),
                new CellPosition(CubeFaces.Back, 1 , 2)
            },

            new CellPosition[]
            {
                new CellPosition(CubeFaces.Right, 1, 2),
                new CellPosition(CubeFaces.Back, 1, 0)
            },

            new CellPosition[]
            {
                new CellPosition(CubeFaces.Left, 2 , 1),
                new CellPosition(CubeFaces.Bottom, 1, 0)
            },

            new CellPosition[]
            {
                new CellPosition(CubeFaces.Right, 2 , 1),
                new CellPosition(CubeFaces.Bottom, 1, 2)
            },

            new CellPosition[]
            {
                new CellPosition(CubeFaces.Back, 2, 1),
                new CellPosition(CubeFaces.Bottom, 2, 1)
            },
        };
    
        // List with the triples that make corners
        public static readonly List<CellPosition[]> Corners = new List<CellPosition[]>
        {
            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 0, 2),
                new CellPosition(CubeFaces.Top, 2, 2),
                new CellPosition(CubeFaces.Right, 0, 0)
            },

            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 0, 0),
                new CellPosition(CubeFaces.Top, 2, 0),
                new CellPosition(CubeFaces.Left, 0, 2)
            },

            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 2, 0),
                new CellPosition(CubeFaces.Left, 2, 2),
                new CellPosition(CubeFaces.Bottom, 0, 0)
            },

            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Front, 2, 2),
                new CellPosition(CubeFaces.Right,  2, 0),
                new CellPosition(CubeFaces.Bottom, 0, 2)
            },

            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Top, 0, 0),
                new CellPosition(CubeFaces.Left, 0, 0),
                new CellPosition(CubeFaces.Back, 0, 2)
            },

            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Top, 0, 2),
                new CellPosition(CubeFaces.Right, 0, 2),
                new CellPosition(CubeFaces.Back, 0, 0)
            },

            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Right, 2, 2),
                new CellPosition(CubeFaces.Back, 2, 0),
                new CellPosition(CubeFaces.Bottom, 2, 2)
            },

            new CellPosition[] 
            { 
                new CellPosition(CubeFaces.Left, 2, 0),
                new CellPosition(CubeFaces.Bottom, 2, 0),
                new CellPosition(CubeFaces.Back, 2, 2)
            },
        };
    }
}