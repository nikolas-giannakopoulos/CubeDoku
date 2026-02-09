namespace ThreeDSudoku.Server.Core
{
    // Represents the position of a cell in the cube
    public class CellPosition
    {
        public CubeFaces face;
        public int row;
        public int column;

        public CellPosition(CubeFaces face, int row, int column)
        {
            this.face = face;
            this.row = row;
            this.column = column;
        }

        // Dictionary support
        public override bool Equals(object? obj)
        {
            if (obj is CellPosition other)
            {
                return this.face == other.face && 
                       this.row == other.row && 
                       this.column == other.column;
            }
            return false;
        }

        public override int GetHashCode()
        {
            return HashCode.Combine(face, row, column);
        }

        // Cell type identification for strategic removal
        public CellType getCellType()
        {
            if (row == 1 && column == 1) 
                return CellType.Center;
            
            // Edge: one coordinate is 1 (center), other is 0 or 2
            if ((row == 1 && column != 1) || (row != 1 && column == 1))
                return CellType.Edge;
            
            // Corner: both coordinates are 0 or 2
            return CellType.Corner;
        }
    }

    public enum CellType
    {
        Center,  // (1,1) - least constraints
        Edge,    // (0,1), (1,0), etc - 2 constraints (Face + Edge pair)
        Corner   // (0,0), (2,2), etc - 3 constraints (Face + Corner triple)
    }
}