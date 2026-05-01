// Cell.cs - the basic unit of my puzzle
// Each cell lives on one face, in one row/column, and holds a number 1-9 (or 0 for empty)
// I initially had the cell store a lot more stuff (like a list of candidates) but my
// supervisor said to keep the model thin and compute candidates on the fly - makes sense now
// that I look back on it but at the time I was annoyed

namespace CubeDoku.Server.Core
{
    public class Cell
    {
        // the number stored in this cell (0 = empty, 1-9 = filled)
        private int cellNumber;

        // used for visual feedback on the frontend - Default/Error/Completed
        // I kept this on the server too even though the client also tracks it,
        // because the checker needs to set it and return it back to the frontend
        private CellState color = CellState.Default;

        // locked cells are the "given" clues that the player can't change
        private bool locked;

        // stores face/row/col so we can look this cell up in the cube easily
        private CellPosition cellPosition;
        
        public Cell(int cellNumber, bool locked, CellPosition cellPosition)
        {
            this.cellNumber = cellNumber;
            this.locked = locked;
            this.cellPosition = cellPosition;
        }

        public bool isLocked()
        {
            return locked;
        }

        // simple setter - originally I had validation here (range check 0-9)
        // but moved it to the controller level with DataAnnotations
        public void setNumber(int cellNumber)
        {
            this.cellNumber = cellNumber;
        }

        public int getNumber()
        {
            return this.cellNumber;
        }

        public CellPosition getPosition()
        {
            return this.cellPosition;
        }

        // color = visual state (Default, Error, Completed)
        // the checker sets this and then we return the updated cells to the client
        public CellState getColor()
        {
            return this.color;
        }

        public void setColor(CellState color)
        {
            this.color = color;
        }
    }
}