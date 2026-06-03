// This is the heart of the game logic - it validates whether a cell placement is legal
// and updates the visual states (Default/Error/Completed) for affected cells.

using System;
using System.Collections.Generic;
using System.Linq;

namespace CubeDoku.Server.Core
{
    public class Checkers
    {

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
                    if (face == 6) return null; // end of cube - no next cell
                }
            }
            return cube.getCell(new CellPosition((CubeFaces)face, row, col));
        }

        // IndividualChecker is called every time the player places a number
        // It figures out which cells changed state and returns only those
        public List<Cell> IndividualChecker(Cell cell, Cube cube)
        {
            List<Cell> updatedCells = new List<Cell>();
            CellPosition cellPos = cell.getPosition();
            int row = cellPos.row;
            int col = cellPos.column;

            Dictionary<Cell, List<string>> cellViolations = new Dictionary<Cell, List<string>>();

            var faceCells = GetFaceCells(cube, cellPos.face);
            bool faceValid = CheckFace(cube, cell);
            bool faceComplete = IsFaceComplete(faceCells);

            if (!faceValid)
            {
                // mark all face cells as having a face violatio
                foreach (var faceCell in faceCells)
                {
                    AddViolation(cellViolations, faceCell, "face");
                }
            }
            else if (faceComplete)
            {
                // face is valid AND all 9 cells are filled - mark them all Completed
                foreach (var faceCell in faceCells)
                {
                    if (faceCell.getColor() != CellState.Completed)
                    {
                        faceCell.setColor(CellState.Completed);
                        updatedCells.Add(faceCell);
                    }
                }
            }

            // edge cells have row+col being odd (one is 0 or 2, the other is 1)
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
                        // both cells in the pair are responsible for the violation
                        AddViolation(cellViolations, cell, "edge");
                        AddViolation(cellViolations, pairedCell, "edge");
                    }
                    else if (edgeComplete)
                    {
                        // edge pair is valid and both cells are filled
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
            // corner cells have even row+col and are NOT the center (1,1)
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
                        // all three corner cells share the blame
                        AddViolation(cellViolations, cell, "corner");
                        AddViolation(cellViolations, pairedCell1, "corner");
                        AddViolation(cellViolations, pairedCell2, "corner");
                    }
                    else if (cornerComplete)
                    {
                        // all three filled and sum is 12 - mark complete
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

            HashSet<Cell> partnerCells = new HashSet<Cell>();
            if ((row + col) % 2 != 0)
            {
                var pairedPos = GetPairedCells(cellPos);
                if (pairedPos != null && pairedPos.Length == 1)
                    partnerCells.Add(cube.getCell(pairedPos[0]));
            }
            else if (!(row == 1 && col == 1))
            {
                var pairedPos = GetPairedCells(cellPos);
                if (pairedPos != null && pairedPos.Length == 2)
                {
                    partnerCells.Add(cube.getCell(pairedPos[0]));
                    partnerCells.Add(cube.getCell(pairedPos[1]));
                }
            }

            // Process same-face cells: can both set AND clear Error
            foreach (var faceCell in faceCells)
            {
                bool hasViolations = cellViolations.ContainsKey(faceCell) && cellViolations[faceCell].Count > 0;
                CellState currentState = faceCell.getColor();

                if (hasViolations && currentState != CellState.Error)
                {
                    faceCell.setColor(CellState.Error);
                    updatedCells.Add(faceCell);
                }
                else if (!hasViolations && currentState == CellState.Error)
                {
                    if (!partnerCells.Contains(faceCell) && !HasSumConstraintViolation(faceCell, cube))
                    {
                        faceCell.setColor(CellState.Default);
                        updatedCells.Add(faceCell);
                    }
                }
            }

            foreach (var partnerCell in partnerCells)
            {
                bool hasViolations = cellViolations.ContainsKey(partnerCell) && cellViolations[partnerCell].Count > 0;
                CellState currentState = partnerCell.getColor();

                if (hasViolations && currentState != CellState.Error)
                {
                    partnerCell.setColor(CellState.Error);
                    updatedCells.Add(partnerCell);
                }
            }

            return updatedCells;
        }

        private bool HasSumConstraintViolation(Cell cell, Cube cube)
        {
            CellPosition pos = cell.getPosition();
            int r = pos.row;
            int c = pos.column;

            // center cells have no edge/corner constraint
            if (r == 1 && c == 1) return false;

            if ((r + c) % 2 != 0)
            {
                // edge cell - check its one partner
                CellPosition[] pairedPos = GetPairedCells(pos);
                if (pairedPos == null || pairedPos.Length != 1) return false;
                Cell partner = cube.getCell(pairedPos[0]);
                int v1 = cell.getNumber();
                int v2 = partner.getNumber();
                if (v1 != 0 && v2 != 0 && v1 + v2 != 12) return true;
            }
            else
            {
                // corner cell - check its two partners
                CellPosition[] pairedPos = GetPairedCells(pos);
                if (pairedPos == null || pairedPos.Length != 2) return false;
                Cell partner1 = cube.getCell(pairedPos[0]);
                Cell partner2 = cube.getCell(pairedPos[1]);
                int v1 = cell.getNumber();
                int v2 = partner1.getNumber();
                int v3 = partner2.getNumber();
                if (v1 != 0 && v2 != 0 && v3 != 0 && v1 + v2 + v3 != 12) return true;
            }

            return false;
        }

        // add a violation type string to a cell's violation list
        // avoids duplicates (don't want "face" added twice for same cell)
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

        // get all 9 cells on a given face as a flat list
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

        // returns true if all 9 cells on the face are non-empty
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
            // 1. Face constraint (no duplicates on this face)
            if (!CheckFace(cube, cell)) return false;

            int r = cell.getPosition().row;
            int c = cell.getPosition().column;

            // center cells only have the face constraint - they don't participate in edge/corner sums
            if (r == 1 && c == 1) return true;

            // odd sum = edge position, even sum = corner position
            if ((r + c) % 2 != 0)
            {
                return CheckEdges(cube);
            }
            else
            {
                return CheckCorners(cube);
            }
        }

        // given a cell position, find its edge partner or corner partners from the topology table
        // returns an array of 1 position (for edges) or 2 positions (for corners)
        // returns null for center cells (no geometric partners)
        public static CellPosition[] GetPairedCells(CellPosition cellPos)
        {
            // center cells don't have geometric pairs
            if (cellPos.row == 1 && cellPos.column == 1)
                return null;

            if ((cellPos.row + cellPos.column) % 2 != 0)
            {
                // edge cell - look up in the Edges table
                foreach (var edgePair in CubeTopology.Edges)
                {
                    if (IsSamePosition(edgePair[0], cellPos))
                        return new[] { edgePair[1] };
                    if (IsSamePosition(edgePair[1], cellPos))
                        return new[] { edgePair[0] };
                }
            }
            else
            {
                // corner cell - look up in the Corners table
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

            return null;
        }

        private static bool IsSamePosition(CellPosition a, CellPosition b)
        {
            return a.face == b.face && a.row == b.row && a.column == b.column;
        }

        // checks ALL edge pairs in the cube - used when we know we're on an edge cell
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
                    // both filled - just check the sum
                    if (valA + valB != 12) return false;
                }
                else if (valA != 0 && valB == 0)
                {
                    // A is filled, B is empty - check if a valid B exists
                    int target = 12 - valA;
                    if (target < 1 || target > 9) return false;
                    // also check if target is already used elsewhere on B's face
                    if (IsNumberUsedInFace(cube, cellB.getPosition().face, target)) return false;
                }
                else if (valB != 0 && valA == 0)
                {
                    // B is filled, A is empty - symmetric case
                    int target = 12 - valB;
                    if (target < 1 || target > 9) return false;
                    if (IsNumberUsedInFace(cube, cellA.getPosition().face, target)) return false;
                }
                // if both empty, no constraint can be violated yet
            }
            return true;
        }

        // checks ALL corner triples - similar lookahead logic as CheckEdges
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
                    // all three filled - check the sum
                    if (valA + valB + valC != 12) return false;
                }
                else if (count == 2)
                {
                    // two filled - check whether the required third value is possible
                    int target = 12 - (valA + valB + valC);
                    if (target < 1 || target > 9) return false;

                    // check each empty cell's face for the target value
                    if (valA == 0 && IsNumberUsedInFace(cube, cellA.getPosition().face, target)) return false;
                    if (valB == 0 && IsNumberUsedInFace(cube, cellB.getPosition().face, target)) return false;
                    if (valC == 0 && IsNumberUsedInFace(cube, cellC.getPosition().face, target)) return false;
                }
                // count < 2: not enough info to validate yet
            }
            return true;
        }

        // standard Sudoku face check: no two cells on the same face have the same number
        // cell with number 0 (empty) is always valid
        public static bool CheckFace(Cube cube, Cell cell)
        {
            var currentFace = cell.getPosition().face;
            var currentNumber = cell.getNumber();

            if (currentNumber == 0) return true;

            for (int i = 0; i < 3; i++)
            {
                for (int j = 0; j < 3; j++)
                {
                    var compareCell = cube.getCell(new CellPosition(currentFace, i, j));
                    // make sure we're not comparing the cell to itself!
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