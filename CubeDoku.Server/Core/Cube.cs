// The main cube object that holds all 54 cells (6 faces × 9 cells each)

namespace CubeDoku.Server.Core
{
    public class Cube
    {
        // 6 faces, each 3x3 grid → 54 cells total
        public Cell[,,] cellList = new Cell[6, 3, 3];

        public Cube()
        {
            createCells();
        }

        // initialize all 54 cells to empty (number=0, not locked)
        public void createCells()
        {
            foreach (var cubeFace in Enum.GetValues<CubeFaces>())
            {
                for (int i = 0; i < 3; i++)
                {
                    for (int j = 0; j < 3; j++)
                    {
                        Cell cell = new Cell(0, false, new CellPosition(cubeFace, i, j));
                        cellList[(int)cubeFace, i, j] = cell;
                    }
                }
            }
        }

        // lookup a cell by its position object
        public Cell getCell(CellPosition position)
        {
            // Transforming the face to integer so we can index into the array
            int faceIndex = (int)position.face;

            // Return the cell based on the list
            return cellList[faceIndex, position.row, position.column];
        }
    }
}