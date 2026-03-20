namespace CubeDoku.Server.Core
{
    /// <summary>
    /// Λύνει 3D Sudoku puzzles χρησιμοποιώντας μόνο ανθρώπινη λογική
    /// CORRECTED VERSION - fixes candidate updates
    /// </summary>
    public class LogicalSolver
    {
        private Cube _cube;
        private Dictionary<CellPosition, HashSet<int>> _candidates;
        private SolvabilityResult _result;
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

                // Classic: Naked Singles + Hidden Singles
                if (ApplyNakedSingles())
                {
                    progress = true;
                    maxDifficulty = Max(maxDifficulty, Difficulty.Classic);
                    continue;
                }

                if (ApplyHiddenSingles())
                {
                    progress = true;
                    maxDifficulty = Max(maxDifficulty, Difficulty.Classic);
                    continue;
                }

                // Brain-Terror: Basic 12-Sum + Naked Pairs
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

                // No progress - stuck!
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

            cell.setNumber(0); // Reset
            return possible;
        }

        #endregion

        #region Solving Techniques

        private bool ApplyNakedSingles()
        {
            bool foundAny = false;
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
                        PlaceNumber(possiblePositions[0], num, "Hidden Single");
                        foundAny = true;
                    }
                }
            }

            return foundAny;
        }

        private bool ApplyBasic12SumDeduction()
        {
            bool foundAny = false;

            // Edges
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

            // Corners
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
                    var emptyPos = valA == 0 ? cornerTriple[0] : (valB == 0 ? cornerTriple[1] : cornerTriple[2]);
                    int required = 12 - (valA + valB + valC);

                    if (required >= 1 && required <= 9 && _candidates.ContainsKey(emptyPos) && _candidates[emptyPos].Contains(required))
                    {
                        if (_candidates[emptyPos].Count > 1)
                        {
                            _candidates[emptyPos] = new HashSet<int> { required };

                            // Determine which values are filled for the reason string
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

        private bool ApplyNakedPairs()
        {
            bool foundAny = false;

            foreach (var face in Enum.GetValues<CubeFaces>())
            {
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

                for (int i = 0; i < facePositions.Count; i++)
                {
                    for (int j = i + 1; j < facePositions.Count; j++)
                    {
                        var pos1 = facePositions[i];
                        var pos2 = facePositions[j];

                        if (_candidates[pos1].Count == 2 && _candidates[pos2].Count == 2 &&
                           _candidates[pos1].SetEquals(_candidates[pos2]))
                        {
                            var pairNumbers = _candidates[pos1];

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

        private void PlaceNumber(CellPosition pos, int value, string reason)
        {
            _cube.getCell(pos).setNumber(value);
            _candidates.Remove(pos);

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

            // Update candidates for affected cells
            UpdateCandidatesAfterPlacement(pos, value);
        }

        private void UpdateCandidatesAfterPlacement(CellPosition placedPos, int value)
        {
            var face = placedPos.face;

            // Remove from same face
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

            // Re-calculate affected edge/corner constraints
            // This is important!
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

        private Difficulty Max(Difficulty a, Difficulty b)
        {
            return (Difficulty)Math.Max((int)a, (int)b);
        }

        #endregion
    }
}
