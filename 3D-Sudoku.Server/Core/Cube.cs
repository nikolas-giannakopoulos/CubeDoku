namespace ThreeDSudoku.Server.Core
{
    public class Cube
    {
        public Cell[,,] cellList = new Cell[6, 3, 3];
        public Cube(){
            createCells();
        }

        public void createCells()
        {
            foreach(var cubeFace in Enum.GetValues<CubeFaces>())
            {
                for(int i = 0; i < 3; i++)
                {
                    for(int j = 0; j < 3; j++)
                        {
                            Cell cell = new Cell(0, false, new CellPosition(cubeFace, i, j));
                            cellList[(int)cubeFace, i, j] = cell;
                        }
                }
            }
        }

        public Cell GetCell(CellPosition position)
        {
            // Transforming the face to integer
            int faceIndex = (int)position.face;
            
            // Return the cell based on the list
            return cellList[faceIndex, position.row, position.column];
        }
    }
}