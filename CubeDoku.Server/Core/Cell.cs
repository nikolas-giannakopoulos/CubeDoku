namespace CubeDoku.Server.Core
{
    public class Cell
    {
        private int cellNumber;
        private CellState color = CellState.Default;
        private bool locked;
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