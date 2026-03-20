using System;
using System.Collections.Generic;
using System.Linq;

namespace CubeDoku.Server.Core
{
    public class Checkers
    {

        // Βοηθητική: Υπολογισμός επόμενου κελιού
        private Cell GetNextCell(Cube cube, Cell cell)
        {
            CellPosition position = cell.getPosition();
            var col = (position.column + 1) % 3;
            int row = position.row;
            int face = (int)position.face;

            if (col == 0)
            {
                row = (row + 1) % 3;
                if (row == 0)
                {
                    face = face + 1;
                    if (face == 6) return null; // Τέλος Κύβου
                }
            }
            return cube.getCell(new CellPosition((CubeFaces)face, row, col));
        }

        public List<Cell> IndividualChecker(Cell cell, Cube cube)
        {
            List<Cell> updatedCells = new List<Cell>();
            CellPosition cellPos = cell.getPosition();
            int row = cellPos.row;
            int col = cellPos.column;

            // Track violations for each cell to manage color state properly
            Dictionary<Cell, List<string>> cellViolations = new Dictionary<Cell, List<string>>();

            // ========== 1. FACE VALIDATION (applies to all cells) ==========
            var faceCells = GetFaceCells(cube, cellPos.face);
            bool faceValid = CheckFace(cube, cell);
            bool faceComplete = IsFaceComplete(faceCells);

            if (!faceValid)
            {
                // Mark all face cells as having a face violation
                foreach (var faceCell in faceCells)
                {
                    AddViolation(cellViolations, faceCell, "face");
                }
            }
            else if (faceComplete)
            {
                // Face is valid and complete - mark for completion animation
                foreach (var faceCell in faceCells)
                {
                    if (faceCell.getColor() != CellState.Completed)
                    {
                        faceCell.setColor(CellState.Completed);
                        updatedCells.Add(faceCell);
                    }
                }
            }

            // ========== 2. EDGE VALIDATION (if edge cell: row+col is odd) ==========
            if ((row + col) % 2 != 0)
            {
                CellPosition[] pairedPositions = GetPairedCells(cellPos);
                if (pairedPositions != null && pairedPositions.Length == 1)
                {
                    Cell pairedCell = cube.getCell(pairedPositions[0]);
                    int val1 = cell.getNumber();
                    int val2 = pairedCell.getNumber();

                    bool edgeValid = true;
                    bool edgeComplete = false;

                    if (val1 != 0 && val2 != 0)
                    {
                        edgeComplete = true;
                        if (val1 + val2 != 12)
                        {
                            edgeValid = false;
                        }
                    }

                    if (!edgeValid)
                    {
                        // Mark both edge cells as having an edge violation
                        AddViolation(cellViolations, cell, "edge");
                        AddViolation(cellViolations, pairedCell, "edge");
                    }
                    else if (edgeComplete)
                    {
                        // Edge is valid and complete - mark both cells
                        if (cell.getColor() != CellState.Completed)
                        {
                            cell.setColor(CellState.Completed);
                            updatedCells.Add(cell);
                        }
                        if (pairedCell.getColor() != CellState.Completed)
                        {
                            pairedCell.setColor(CellState.Completed);
                            updatedCells.Add(pairedCell);
                        }
                    }
                }
            }
            // ========== 3. CORNER VALIDATION (if corner: row+col is even, excluding center) ==========
            else if (!(row == 1 && col == 1))
            {
                CellPosition[] pairedPositions = GetPairedCells(cellPos);
                if (pairedPositions != null && pairedPositions.Length == 2)
                {
                    Cell pairedCell1 = cube.getCell(pairedPositions[0]);
                    Cell pairedCell2 = cube.getCell(pairedPositions[1]);
                    
                    int val1 = cell.getNumber();
                    int val2 = pairedCell1.getNumber();
                    int val3 = pairedCell2.getNumber();

                    bool cornerValid = true;
                    bool cornerComplete = false;

                    if (val1 != 0 && val2 != 0 && val3 != 0)
                    {
                        cornerComplete = true;
                        if (val1 + val2 + val3 != 12)
                        {
                            cornerValid = false;
                        }
                    }

                    if (!cornerValid)
                    {
                        // Mark all corner cells as having a corner violation
                        AddViolation(cellViolations, cell, "corner");
                        AddViolation(cellViolations, pairedCell1, "corner");
                        AddViolation(cellViolations, pairedCell2, "corner");
                    }
                    else if (cornerComplete)
                    {
                        // Corner is valid and complete - mark all 3 cells
                        if (cell.getColor() != CellState.Completed)
                        {
                            cell.setColor(CellState.Completed);
                            updatedCells.Add(cell);
                        }
                        if (pairedCell1.getColor() != CellState.Completed)
                        {
                            pairedCell1.setColor(CellState.Completed);
                            updatedCells.Add(pairedCell1);
                        }
                        if (pairedCell2.getColor() != CellState.Completed)
                        {
                            pairedCell2.setColor(CellState.Completed);
                            updatedCells.Add(pairedCell2);
                        }
                    }
                }
            }

            // ========== 4. UPDATE COLORS BASED ON VIOLATIONS ==========
            // First, collect all cells that might need color updates
            HashSet<Cell> cellsToCheck = new HashSet<Cell>();
            
            // Add face cells
            cellsToCheck.UnionWith(faceCells);
            
            // Add edge/corner paired cells
            if ((row + col) % 2 != 0)
            {
                // Edge cell
                var pairedPos = GetPairedCells(cellPos);
                if (pairedPos != null && pairedPos.Length == 1)
                {
                    cellsToCheck.Add(cell);
                    cellsToCheck.Add(cube.getCell(pairedPos[0]));
                }
            }
            else if (!(row == 1 && col == 1))
            {
                // Corner cell
                var pairedPos = GetPairedCells(cellPos);
                if (pairedPos != null && pairedPos.Length == 2)
                {
                    cellsToCheck.Add(cell);
                    cellsToCheck.Add(cube.getCell(pairedPos[0]));
                    cellsToCheck.Add(cube.getCell(pairedPos[1]));
                }
            }

            // Update colors for all affected cells
            foreach (var cellToCheck in cellsToCheck)
            {
                bool hasViolations = cellViolations.ContainsKey(cellToCheck) && cellViolations[cellToCheck].Count > 0;
                CellState currentState = cellToCheck.getColor();
                
                if (hasViolations && currentState != CellState.Error)
                {
                    cellToCheck.setColor(CellState.Error);
                    updatedCells.Add(cellToCheck);
                }
                else if (!hasViolations && currentState == CellState.Error)
                {
                    // Return to default if previously in error state
                    cellToCheck.setColor(CellState.Default);
                    updatedCells.Add(cellToCheck);
                }
            }

            return updatedCells;
        }

        // Helper: Add a violation type to a cell
        private void AddViolation(Dictionary<Cell, List<string>> violations, Cell cell, string violationType)
        {
            if (!violations.ContainsKey(cell))
            {
                violations[cell] = new List<string>();
            }
            if (!violations[cell].Contains(violationType))
            {
                violations[cell].Add(violationType);
            }
        }

        // Helper: Get all cells on a specific face
        private List<Cell> GetFaceCells(Cube cube, CubeFaces face)
        {
            List<Cell> cells = new List<Cell>();
            for (int i = 0; i < 3; i++)
            {
                for (int j = 0; j < 3; j++)
                {
                    cells.Add(cube.getCell(new CellPosition(face, i, j)));
                }
            }
            return cells;
        }

        // Helper: Check if a face is complete (all cells have numbers)
        private bool IsFaceComplete(List<Cell> faceCells)
        {
            foreach (var cell in faceCells)
            {
                if (cell.getNumber() == 0)
                {
                    return false;
                }
            }
            return true;
        }

        public static bool Checker(Cell cell, Cube cube)
        {
            // 1. Sudoku Check
            if (!CheckFace(cube, cell)) return false;

            int r = cell.getPosition().row;
            int c = cell.getPosition().column;

            // 2. Center (1,1) is always safe geometrically
            if (r == 1 && c == 1) return true;

            // 3. Mathematical check: Odd sum = Edge, Even sum = Corner
            if ((r + c) % 2 != 0)
            {
                return CheckEdges(cube); // Καλεί την "Τούρμπο" έκδοση
            }
            else
            {
                return CheckCorners(cube); // Καλεί την "Τούρμπο" έκδοση
            }
        }

        public static CellPosition[] GetPairedCells(CellPosition cellPos)
        {
            // Check if it's a center cell (no pairs)
            if (cellPos.row == 1 && cellPos.column == 1)
                return null;

            // Check edges first (row + column is odd)
            if ((cellPos.row + cellPos.column) % 2 != 0)
            {
                foreach (var edgePair in CubeTopology.Edges)
                {
                    if (IsSamePosition(edgePair[0], cellPos))
                        return new[] { edgePair[1] };
                    if (IsSamePosition(edgePair[1], cellPos))
                        return new[] { edgePair[0] };
                }
            }
            else // Check corners (row + column is even, excluding center)
            {
                foreach (var cornerTriple in CubeTopology.Corners)
                {
                    if (IsSamePosition(cornerTriple[0], cellPos))
                        return new[] { cornerTriple[1], cornerTriple[2] };
                    if (IsSamePosition(cornerTriple[1], cellPos))
                        return new[] { cornerTriple[0], cornerTriple[2] };
                    if (IsSamePosition(cornerTriple[2], cellPos))
                        return new[] { cornerTriple[0], cornerTriple[1] };
                }
            }

            return null; // Should not happen if cellPos is valid
        }

        /// <summary>
        /// Helper method to compare two CellPosition objects
        /// </summary>
        private static bool IsSamePosition(CellPosition a, CellPosition b)
        {
            return a.face == b.face && a.row == b.row && a.column == b.column;
        }

        public static bool CheckEdges(Cube cube)
        {
            foreach (var edgePair in CubeTopology.Edges)
            {
                var cellA = cube.getCell(edgePair[0]);
                var cellB = cube.getCell(edgePair[1]);

                int valA = cellA.getNumber();
                int valB = cellB.getNumber();

                if (valA != 0 && valB != 0)
                {
                    if (valA + valB != 12) return false;
                }
                else if (valA != 0 && valB == 0)
                {
                    int target = 12 - valA;
                    if (target < 1 || target > 9) return false;
                    if (IsNumberUsedInFace(cube, cellB.getPosition().face, target)) return false;
                }
                else if (valB != 0 && valA == 0)
                {
                    int target = 12 - valB;
                    if (target < 1 || target > 9) return false;
                    if (IsNumberUsedInFace(cube, cellA.getPosition().face, target)) return false;
                }
            }
            return true;
        }

        public static bool CheckCorners(Cube cube)
        {
            foreach (var cornerTriple in CubeTopology.Corners)
            {
                var cellA = cube.getCell(cornerTriple[0]);
                var cellB = cube.getCell(cornerTriple[1]);
                var cellC = cube.getCell(cornerTriple[2]);

                int valA = cellA.getNumber();
                int valB = cellB.getNumber();
                int valC = cellC.getNumber();

                int count = (valA > 0 ? 1 : 0) + (valB > 0 ? 1 : 0) + (valC > 0 ? 1 : 0);

                if (count == 3)
                {
                    if (valA + valB + valC != 12) return false;
                }
                else if (count == 2)
                {
                    int target = 12 - (valA + valB + valC);
                    if (target < 1 || target > 9) return false;

                    // Ελέγχουμε αν το target είναι διαθέσιμο στην πλευρά του κενού κελιού
                    if (valA == 0 && IsNumberUsedInFace(cube, cellA.getPosition().face, target)) return false;
                    if (valB == 0 && IsNumberUsedInFace(cube, cellB.getPosition().face, target)) return false;
                    if (valC == 0 && IsNumberUsedInFace(cube, cellC.getPosition().face, target)) return false;
                }
            }
            return true;
        }

        public static bool CheckFace(Cube cube, Cell cell)
        {
            var currentFace = cell.getPosition().face;
            var currentNumber = cell.getNumber();

            if(currentNumber == 0) return true;

            for (int i = 0; i < 3; i++)
            {
                for (int j = 0; j < 3; j++)
                {
                    var compareCell = cube.getCell(new CellPosition(currentFace, i, j));
                    // Προσοχή: Ελέγχουμε αν είναι διαφορετικό κελί πριν συγκρίνουμε τιμή
                    if (compareCell != cell && compareCell.getNumber() == currentNumber)
                    {
                        return false;
                    }
                }
            }
            return true;
        }

        private static bool IsNumberUsedInFace(Cube cube, CubeFaces face, int numberToCheck)
        {
            for (int r = 0; r < 3; r++)
            {
                for (int c = 0; c < 3; c++)
                {
                    if (cube.getCell(new CellPosition(face, r, c)).getNumber() == numberToCheck) return true;
                }
            }
            return false;
        }
    }
}