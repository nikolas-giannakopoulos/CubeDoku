// CellPosition.cs
// Represents where in the cube a cell lives: which face, which row, which column
// Rows and columns go 0,1,2 (so 3x3 per face)
//
// I also stuck the cell-type logic here because it naturally fits - the position itself
// determines whether it's a center, edge, or corner cell. My supervisor pointed out this
// violates SRP a bit, but honestly I think it's fine for a project this size.

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

        // needed this so I can use CellPosition as a dictionary key in the LogicalSolver
        // see: https://stackoverflow.com/questions/371328/why-is-it-important-to-override-gethashcode-when-equals-method-is-overridden
        // apparently if you override Equals you HAVE to override GetHashCode too or dictionaries break
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
        // this is used by the puzzle generator to decide which cells to remove first
        // (center cells have the fewest constraints so they're removed first)
        //
        // the math: 
        //   center = row==1, col==1
        //   edge = exactly ONE of row/col is 1 (middle of a side)
        //   corner = neither row nor col is 1
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