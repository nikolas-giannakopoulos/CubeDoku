// LogicalSolver.cs
// Solves a 3D Sudoku using ONLY human-logical techniques (no backtracking/guessing)
//
// This serves two purposes in the system:
//   1. During puzzle generation: verify that a puzzle can be solved logically (no guessing)
//      and determine its difficulty based on which techniques were required
//   2. For the hint system: the logical steps recorded here are given to players as hints
//      (because a logical hint like "Naked Single" is more useful than a random reveal)
//
// Techniques implemented (in order of difficulty):
//   - Naked Singles: cell with only one possible value
//   - Hidden Singles: number that can only go in one cell on a face
//   - Basic 12-Sum Deduction: use edge/corner constraints to force values
//   - Naked Pairs: if two cells on a face have the same two candidates, eliminate from others
//
// The solver tracks which technique was used at each step.
// If a puzzle gets stuck (no technique makes progress) it's either BrainTerror level
// (requires guessing) or it's truly unsolvable — either way, the generator rejects it.
//
// NOTE: this is "CORRECTED VERSION" - earlier I had a bug where UpdateCandidatesAfterPlacement
// only removed the value from the same face, but didn't recalculate edge/corner candidates.
// That caused the solver to sometimes think values were valid when they weren't.
// Fixed by doing a full recalc of all remaining candidates after each placement.
// It's slower but it's correct.

namespace CubeDoku.Server.Core
{
    public class LogicalSolver
    {
        private Cube _cube;

        // maps each empty cell position to the set of values it could still legally hold
        // this is updated after every placement
        private Dictionary<CellPosition, HashSet<int>> _candidates;

        private SolvabilityResult _result;

        // debug flag - when true, prints progress to console
        // useful during development, left in because it's toggled off by default
        private bool _debug = false;

        public LogicalSolver(Cube cube, bool debug = false)
        {
            _cube = cube;
            _candidates = new Dictionary<CellPosition, HashSet<int>>();
            _result = new SolvabilityResult();
            _debug = debug;
            InitializeCandidates();
        }

        public SolvabilityResult Result => _result;

        // main entry: apply techniques in order until either solved or stuck
        // returns the result describing difficulty, whether solved, and the steps taken
        public SolvabilityResult Solve()
        {
            bool progress = true;
            Difficulty maxDifficulty = Difficulty.Classic;
            int iterations = 0;

            while (progress && !IsSolved())
            {
                progress = false;
                iterations++;

                if (_debug && iterations % 10 == 0)
                {
                    Console.WriteLine($"  Iteration {iterations}, empty cells: {_candidates.Count}");
                }

                // Try Classic techniques first (faster/simpler)
                if (ApplyNakedSingles())
                {
                    progress = true;
                    maxDifficulty = Max(maxDifficulty, Difficulty.Classic);
                    continue; // restart the loop after each successful step
                }

                if (ApplyHiddenSingles())
                {
                    progress = true;
                    maxDifficulty = Max(maxDifficulty, Difficulty.Classic);
                    continue;
                }

                // If Classic techniques fail, try BrainTerror techniques
                if (ApplyBasic12SumDeduction())
                {
                    progress = true;
                    maxDifficulty = Max(maxDifficulty, Difficulty.BrainTerror);
                    continue;
                }

                if (ApplyNakedPairs())
                {
                    progress = true;
                    maxDifficulty = Max(maxDifficulty, Difficulty.BrainTerror);
                    continue;
                }

                // nothing worked this iteration - we're stuck
                if (!progress)
                {
                    if (_debug)
                    {
                        Console.WriteLine($"  STUCK at iteration {iterations} with {_candidates.Count} empty cells");
                    }
                    break;
                }
            }

            _result.IsSolvable = IsSolved();
            _result.Difficulty = _result.IsSolvable ? maxDifficulty : Difficulty.BrainTerror;

            if (_debug)
            {
                Console.WriteLine($"  Final: {(_result.IsSolvable ? "SOLVED" : "IMPOSSIBLE")} as {_result.Difficulty}");
            }

            return _result;
        }

        #region Initialization

        // build the initial candidates dictionary - for each empty cell, what values are valid?
        private void InitializeCandidates()
        {
            foreach (var face in Enum.GetValues<CubeFaces>())
            {
                for (int row = 0; row < 3; row++)
                {
                    for (int col = 0; col < 3; col++)
                    {
                        var pos = new CellPosition(face, row, col);
                        var cell = _cube.getCell(pos);

                        if (cell.getNumber() == 0)
                        {
                            _candidates[pos] = GetPossibleValues(pos);
                        }
                    }
                }
            }

            if (_debug)
            {
                Console.WriteLine($"  Initialized {_candidates.Count} empty cells");
            }
        }

        // compute valid values for a position by trying each number and calling Checker
        // this is essentially brute-force but we only do it for initialization and after placements
        private HashSet<int> GetPossibleValues(CellPosition pos)
        {
            var possible = new HashSet<int> { 1, 2, 3, 4, 5, 6, 7, 8, 9 };
            var cell = _cube.getCell(pos);

            for (int n = 1; n <= 9; n++)
            {
                cell.setNumber(n);
                if (!Checkers.Checker(cell, _cube))
                {
                    possible.Remove(n);
                }
            }

            cell.setNumber(0); // reset after testing
            return possible;
        }

        #endregion

        #region Solving Techniques

        // Naked Single: a cell with exactly one candidate - that value must go there
        // this is the most basic technique and handles most of the puzzle
        private bool ApplyNakedSingles()
        {
            bool foundAny = false;

            // collect first because we can't modify the dictionary while iterating it
            var toPlace = new List<(CellPosition pos, int value)>();

            foreach (var kvp in _candidates)
            {
                if (kvp.Value.Count == 1)
                {
                    toPlace.Add((kvp.Key, kvp.Value.First()));
                }
            }

            foreach (var (pos, value) in toPlace)
            {
                PlaceNumber(pos, value, "Naked Single");
                foundAny = true;
            }

            return foundAny;
        }

        // Hidden Single: a number that can only go in one cell on a face
        // even if that cell has multiple candidates, this number is forced there
        private bool ApplyHiddenSingles()
        {
            bool foundAny = false;

            foreach (var face in Enum.GetValues<CubeFaces>())
            {
                for (int num = 1; num <= 9; num++)
                {
                    var possiblePositions = new List<CellPosition>();

                    for (int row = 0; row < 3; row++)
                    {
                        for (int col = 0; col < 3; col++)
                        {
                            var pos = new CellPosition(face, row, col);
                            if (_candidates.ContainsKey(pos) && _candidates[pos].Contains(num))
                            {
                                possiblePositions.Add(pos);
                            }
                        }
                    }

                    if (possiblePositions.Count == 1)
                    {
                        // only one place this number can go on this face
                        PlaceNumber(possiblePositions[0], num, "Hidden Single");
                        foundAny = true;
                    }
                }
            }

            return foundAny;
        }

        // Basic 12-Sum Deduction: when one cell in an edge/corner pair is known,
        // the other cell's value is forced (12 - known_value)
        // Only applies if the candidate set for the empty cell contains the required value
        private bool ApplyBasic12SumDeduction()
        {
            bool foundAny = false;

            // check edges
            foreach (var edgePair in CubeTopology.Edges)
            {
                var cellA = _cube.getCell(edgePair[0]);
                var cellB = _cube.getCell(edgePair[1]);

                int valA = cellA.getNumber();
                int valB = cellB.getNumber();

                if (valA != 0 && valB == 0 && _candidates.ContainsKey(edgePair[1]))
                {
                    int required = 12 - valA;
                    if (required >= 1 && required <= 9 && _candidates[edgePair[1]].Contains(required))
                    {
                        if (_candidates[edgePair[1]].Count > 1)
                        {
                            _candidates[edgePair[1]] = new HashSet<int> { required };
                            PlaceNumber(edgePair[1], required, $"Edge 12-Sum: 12 - {valA} = {required}");
                            foundAny = true;
                        }
                    }
                }
                else if (valB != 0 && valA == 0 && _candidates.ContainsKey(edgePair[0]))
                {
                    int required = 12 - valB;
                    if (required >= 1 && required <= 9 && _candidates[edgePair[0]].Contains(required))
                    {
                        if (_candidates[edgePair[0]].Count > 1)
                        {
                            _candidates[edgePair[0]] = new HashSet<int> { required };
                            PlaceNumber(edgePair[0], required, $"Edge 12-Sum: 12 - {valB} = {required}");
                            foundAny = true;
                        }
                    }
                }
            }

            // check corners - same idea but with 3 cells instead of 2
            foreach (var cornerTriple in CubeTopology.Corners)
            {
                var cellA = _cube.getCell(cornerTriple[0]);
                var cellB = _cube.getCell(cornerTriple[1]);
                var cellC = _cube.getCell(cornerTriple[2]);

                int valA = cellA.getNumber();
                int valB = cellB.getNumber();
                int valC = cellC.getNumber();

                int filled = (valA > 0 ? 1 : 0) + (valB > 0 ? 1 : 0) + (valC > 0 ? 1 : 0);

                if (filled == 2)
                {
                    // two cells are known, the third is forced
                    var emptyPos = valA == 0 ? cornerTriple[0] : (valB == 0 ? cornerTriple[1] : cornerTriple[2]);
                    int required = 12 - (valA + valB + valC);

                    if (required >= 1 && required <= 9 && _candidates.ContainsKey(emptyPos) && _candidates[emptyPos].Contains(required))
                    {
                        if (_candidates[emptyPos].Count > 1)
                        {
                            _candidates[emptyPos] = new HashSet<int> { required };

                            // build a readable reason string for the hint system
                            var filledValues = new List<int>();
                            if (valA > 0) filledValues.Add(valA);
                            if (valB > 0) filledValues.Add(valB);
                            if (valC > 0) filledValues.Add(valC);
                            
                            string reason = $"Corner 12-Sum: 12 - ({string.Join("+", filledValues)}) = {required}";
                            PlaceNumber(emptyPos, required, reason);
                            foundAny = true;
                        }
                    }
                }
            }

            return foundAny;
        }

        // Naked Pairs: if two cells on a face share the exact same two candidates,
        // those two values can be eliminated from all other cells on that face
        // this is a classic Sudoku technique - I was quite proud when I got this working
        private bool ApplyNakedPairs()
        {
            bool foundAny = false;

            foreach (var face in Enum.GetValues<CubeFaces>())
            {
                // collect all empty positions on this face
                var facePositions = new List<CellPosition>();

                for (int row = 0; row < 3; row++)
                {
                    for (int col = 0; col < 3; col++)
                    {
                        var pos = new CellPosition(face, row, col);
                        if (_candidates.ContainsKey(pos))
                        {
                            facePositions.Add(pos);
                        }
                    }
                }

                // look at all pairs of empty cells on this face
                for (int i = 0; i < facePositions.Count; i++)
                {
                    for (int j = i + 1; j < facePositions.Count; j++)
                    {
                        var pos1 = facePositions[i];
                        var pos2 = facePositions[j];

                        // if both have exactly 2 candidates and they're the same two values → naked pair!
                        if (_candidates[pos1].Count == 2 && _candidates[pos2].Count == 2 &&
                           _candidates[pos1].SetEquals(_candidates[pos2]))
                        {
                            var pairNumbers = _candidates[pos1];

                            // eliminate both values from every other cell on this face
                            foreach (var pos in facePositions)
                            {
                                if (pos.Equals(pos1) || pos.Equals(pos2)) continue;

                                bool removed = false;
                                foreach (var num in pairNumbers.ToList())
                                {
                                    if (_candidates[pos].Remove(num))
                                    {
                                        removed = true;
                                    }
                                }

                                if (removed)
                                {
                                    IncrementTechnique("Naked Pair");
                                    foundAny = true;
                                }
                            }
                        }
                    }
                }
            }

            return foundAny;
        }

        #endregion

        #region Helper Methods

        // place a value in the cube and record the step for the hint system
        private void PlaceNumber(CellPosition pos, int value, string reason)
        {
            _cube.getCell(pos).setNumber(value);
            _candidates.Remove(pos); // this cell is no longer empty

            var step = new LogicalStep
            {
                Position = pos,
                Value = value,
                Reason = reason
            };
            _result.Steps.Add(step);
            IncrementTechnique(reason);

            if (_debug)
            {
                Console.WriteLine($"    {step}");
            }

            // IMPORTANT: after placing a value, we need to recalculate ALL remaining candidates
            // because edge/corner constraints might have changed what's valid elsewhere
            // This is the fix for the bug mentioned at the top of the file
            UpdateCandidatesAfterPlacement(pos, value);
        }

        // recalculate candidates after a placement
        // first removes the value from the same face (fast, always applicable)
        // then does a full recalc for all remaining cells (slower but necessary for edge/corner constraints)
        private void UpdateCandidatesAfterPlacement(CellPosition placedPos, int value)
        {
            var face = placedPos.face;

            // quick removal: this value can't appear again on the same face
            for (int row = 0; row < 3; row++)
            {
                for (int col = 0; col < 3; col++)
                {
                    var pos = new CellPosition(face, row, col);
                    if (_candidates.ContainsKey(pos))
                    {
                        _candidates[pos].Remove(value);
                    }
                }
            }

            // full recalc: edge/corner constraints changed so we need to recheck everything
            // this is expensive but I couldn't find a faster way that's still correct
            // maybe I could only recalc cells in the same edge/corner groups as placedPos?
            // TODO: optimize this if generation gets slow
            foreach (var pos in _candidates.Keys.ToList())
            {
                _candidates[pos] = GetPossibleValues(pos);
            }
        }

        private bool IsSolved()
        {
            return _candidates.Count == 0;
        }

        private void IncrementTechnique(string technique)
        {
            if (!_result.TechniquesUsed.ContainsKey(technique))
            {
                _result.TechniquesUsed[technique] = 0;
            }
            _result.TechniquesUsed[technique]++;
            _result.StepsRequired++;
        }

        // just returns the higher difficulty enum value
        private Difficulty Max(Difficulty a, Difficulty b)
        {
            return (Difficulty)Math.Max((int)a, (int)b);
        }

        #endregion
    }
}

