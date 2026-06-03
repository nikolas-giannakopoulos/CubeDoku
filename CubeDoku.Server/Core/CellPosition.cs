namespace CubeDoku.Server.Core
{
    // Represents the position of a cell in the cube
    public class CellPosition
    {
        public CubeFaces face { get; set; }
        public int row { get; set; }
        public int column { get; set; }

        public CellPosition(CubeFaces face, int row, int column)
        {
            this.face = face;
            this.row = row;
            this.column = column;
        }

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

        // figure out if this position is a Center, Edge, or Corner cell
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

    // used to classify cells by their geometric role on the cube face
    // the puzzle generator uses this to decide removal order (center first)
    public enum CellType
    {
        Center,  // (1,1) - least constraints (only the face rule applies)
        Edge,    // (0,1), (1,0), etc - 2 constraints (Face + Edge pair)
        Corner   // (0,0), (2,2), etc - 3 constraints (Face + Corner triple)
    }
}