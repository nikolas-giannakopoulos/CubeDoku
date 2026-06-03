// PuzzleGenerator.cs
// Generates a valid 3D Sudoku puzzle with:
//   - exactly one solution (unique puzzle)
//   - the right difficulty (determined by which logical techniques are needed)
//
// The process is roughly:
//   1. Generate a fully solved cube using the backtracking Solver
//   2. Remove cells one by one (in a smart order) while maintaining uniqueness
//   3. Classify the resulting puzzle using the LogicalSolver
//   4. If it matches the target difficulty, keep it; otherwise try again
//
// The "strategic removal" approach (GenerateUniquePuzzleStrategic) removes cells in order
// of fewest constraints (center → edges → corners) which tends to produce puzzles that
// stay solvable longer before we run out of cells to remove.
//
// For Classic difficulty we aim for ~25 clues.
// For BrainTerror we try to minimize clues as much as possible.
//
// Generation can take a while because we might go through many attempts before finding
// a puzzle that both has a unique solution AND matches the target difficulty.
// 50 attempts was chosen experimentally - seems to always find something within 20-30 tries.
// TODO: should probably add a timeout or max-attempt warning for the server logs

namespace CubeDoku.Server.Core
{
    public class PuzzleGenerator
    {
        private Random _random;
        private int _seed;

        public PuzzleGenerator(int seed)
        {
            _seed = seed;
            _random = new Random(seed);
        }

        // old simple generator - kept for reference but not used anymore
        // GeneratePuzzle() uses GenerateUniquePuzzleStrategic() internally now
        // the difference: this one removes cells randomly, the strategic one removes center cells first
        public Cube GenerateUniquePuzzle(out int clueCount)
        {
            Console.WriteLine($"🎲 Generating puzzle with seed: {_seed}");
            
            // 1. create a fully solved cube
            Cube solvedCube = new Cube();
            Solver solver = new Solver(_seed);
            
            if (!solver.run(solvedCube))
            {
                throw new Exception("Failed to generate solved cube!");
            }
            
            Console.WriteLine($"✅ Generated solved cube in {solver.Iterations:N0} iterations");

            // 2. clone so we don't modify the solution
            Cube puzzleCube = CloneCube(solvedCube);

            // 3. get all cells to try removing
            List<Cell> cellsToRemove = GetAllCells(puzzleCube);
            
            // 4. randomize removal order
            ShuffleCells(cellsToRemove);

            int removed = 0;
            int attempts = 0;

            Console.WriteLine($"🔍 Starting to remove clues...");

            // 5. try removing each cell one at a time
            foreach (var cell in cellsToRemove)
            {
                attempts++;
                int originalValue = cell.getNumber();
                
                cell.setNumber(0); // hide the cell

                // check if the puzzle still has exactly one solution
                Cube testCube = CloneCube(puzzleCube);
                Solver testSolver = new Solver(_seed + 1000); // different seed so counting is unbiased
                
                int solutions = testSolver.CountSolutions(testCube, 2);

                if (solutions == 1)
                {
                    // unique solution preserved - keep this cell hidden
                    removed++;
                    if (removed % 5 == 0)
                    {
                        Console.WriteLine($"  ✓ Removed {removed} clues so far... ({attempts} attempts)");
                    }
                }
                else
                {
                    // removing this cell created ambiguity - put it back
                    cell.setNumber(originalValue);
                }
            }

            clueCount = 54 - removed;
            Console.WriteLine($"🎯 Final puzzle has {clueCount} clues ({removed} removed)");
            
            return puzzleCube;
        }

        // get all 54 cells as a flat list (for shuffling and removing)
        private List<Cell> GetAllCells(Cube cube)
        {
            List<Cell> cells = new List<Cell>();
            
            foreach (var face in Enum.GetValues<CubeFaces>())
            {
                for (int row = 0; row < 3; row++)
                {
                    for (int col = 0; col < 3; col++)
                    {
                        cells.Add(cube.getCell(new CellPosition(face, row, col)));
                    }
                }
            }
            
            return cells;
        }

        // standard Fisher-Yates shuffle for the cell list
        private void ShuffleCells(List<Cell> cells)
        {
            int n = cells.Count;
            while (n > 1)
            {
                n--;
                int k = _random.Next(n + 1);
                Cell temp = cells[k];
                cells[k] = cells[n];
                cells[n] = temp;
            }
        }

        private Cube CloneCube(Cube original)
        {
            Cube clone = new Cube();
            
            foreach (var face in Enum.GetValues<CubeFaces>())
            {
                for (int row = 0; row < 3; row++)
                {
                    for (int col = 0; col < 3; col++)
                    {
                        var pos = new CellPosition(face, row, col);
                        var originalCell = original.getCell(pos);
                        var cloneCell = clone.getCell(pos);
                        cloneCell.setNumber(originalCell.getNumber());
                    }
                }
            }
            
            return clone;
        }

        /// Main entry point for puzzle generation - tries multiple seeds to find a puzzle
        /// that matches the target difficulty and has fewer clues (harder puzzles).
        public (Cube Puzzle, List<LogicalStep> Steps) GeneratePuzzle(Difficulty targetDifficulty, int maxAttempts = 50)
        {
            Console.WriteLine($"🎯 Generating {targetDifficulty} puzzle (max {maxAttempts} attempts)...");

            Cube bestPuzzle = null;
            int bestClueCount = 54;
            SolvabilityResult bestResult = null;

            // keep a fallback in case we never find a perfect match
            Cube fallbackPuzzle = null;
            int fallbackClueCount = 54;
            SolvabilityResult fallbackResult = null;
            
            // Classic aims for 25 clues, BrainTerror tries to minimize
            int targetClues = targetDifficulty == Difficulty.Classic ? 25 : 0;

            for (int attempt = 1; attempt <= maxAttempts; attempt++)
            {
                // use a different internal seed for each attempt
                int attemptSeed = _seed + attempt * 1000;
                var tempGenerator = new PuzzleGenerator(attemptSeed);

                var puzzle = tempGenerator.GenerateUniquePuzzleStrategic(targetClues, out int tempClues);

                // test if it can be solved logically
                var testCube = CloneCube(puzzle);
                var logicalSolver = new LogicalSolver(testCube);
                var result = logicalSolver.Solve();

                // save first solvable puzzle as fallback
                if (result.IsSolvable && fallbackPuzzle == null)
                {
                    fallbackPuzzle = puzzle;
                    fallbackClueCount = tempClues;
                    fallbackResult = result;
                }

                if (result.IsSolvable && result.Difficulty <= targetDifficulty)
                {
                    if (attempt % 5 == 0 || result.Difficulty == targetDifficulty)
                    {
                        Console.WriteLine($"  Attempt {attempt}: {result.Difficulty} with {tempClues} clues");
                    }

                    bool isBetter = false;
                    
                    if (targetDifficulty == Difficulty.Classic)
                    {
                        // for Classic we want closest to 25 clues
                        if (bestPuzzle == null) isBetter = true;
                        else if (Math.Abs(tempClues - targetClues) < Math.Abs(bestClueCount - targetClues)) isBetter = true;
                    }
                    else
                    {
                        // BrainTerror: fewer clues = harder = better
                        if (bestPuzzle == null) isBetter = true;
                        else if (result.Difficulty == targetDifficulty && tempClues < bestClueCount) isBetter = true;
                    }

                    if (isBetter)
                    {
                        bestPuzzle = puzzle;
                        bestClueCount = tempClues;
                        bestResult = result;
                    }
                }
            }

            if (bestPuzzle == null)
            {
                if (fallbackPuzzle != null)
                {
                    Console.WriteLine($"No exact {targetDifficulty} puzzle found. Using fallback ({fallbackResult!.Difficulty}) with {fallbackClueCount} clues.");
                    bestPuzzle = fallbackPuzzle;
                    bestClueCount = fallbackClueCount;
                    bestResult = fallbackResult;
                }
                else
                {
                    throw new Exception($"Failed to generate any solvable puzzle after {maxAttempts} attempts");
                }
            }

            if (bestResult == null)
            {
                throw new Exception("Puzzle generation completed without a solvability result.");
            }

            Console.WriteLine($"Generated {bestResult.Difficulty} puzzle with {bestClueCount} clues");
            Console.WriteLine($"   Steps required: {bestResult.StepsRequired}");
            foreach (var tech in bestResult.TechniquesUsed ?? new Dictionary<string, int>())
            {
                Console.WriteLine($"   - {tech.Key}: {tech.Value} times");
            }

            Console.WriteLine("\nLogical Solving Steps for the Generated Puzzle:");
            var finalTestCube = CloneCube(bestPuzzle);
            var stepLogger = new LogicalSolver(finalTestCube, debug: true);
            stepLogger.Solve();
            Console.WriteLine("--------------------------------------------------\n");

            return (bestPuzzle, stepLogger.Result?.Steps ?? new List<LogicalStep>());
        }

        /// Strategic removal: removes cells in the order Center → Edge → Corner
        private Cube GenerateUniquePuzzleStrategic(int targetClues, out int clueCount)
        {
            // 1. generate a solved cube
            Cube solvedCube = new Cube();
            Solver solver = new Solver(_seed);
            
            if (!solver.run(solvedCube))
            {
                throw new Exception("Failed to generate solved cube!");
            }

            // 2. clone to puzzle
            Cube puzzleCube = CloneCube(solvedCube);

            // 3. categorize cells by type
            var centers = new List<Cell>();
            var edges = new List<Cell>();
            var corners = new List<Cell>();

            foreach (var face in Enum.GetValues<CubeFaces>())
            {
                for (int row = 0; row < 3; row++)
                {
                    for (int col = 0; col < 3; col++)
                    {
                        var pos = new CellPosition(face, row, col);
                        var cell = puzzleCube.getCell(pos);
                        var type = pos.getCellType();

                        if (type == CellType.Center) centers.Add(cell);
                        else if (type == CellType.Edge) edges.Add(cell);
                        else corners.Add(cell);
                    }
                }
            }

            // 4. shuffle each group independently, then combine in order
            ShuffleCells(centers);
            ShuffleCells(edges);
            ShuffleCells(corners);

            var orderedCells = new List<Cell>();
            orderedCells.AddRange(centers);
            orderedCells.AddRange(edges);
            orderedCells.AddRange(corners);

            int removed = 0;
            // 54 total cells in a 3x3x6 cube
            foreach (var cell in orderedCells)
            {
                // stop if we've hit the target clue count
                if (targetClues > 0 && (54 - removed) <= targetClues)
                {
                    break;
                }

                int originalValue = cell.getNumber();
                cell.setNumber(0);

                // verify uniqueness on a fresh clone
                Cube testCube = CloneCube(puzzleCube);
                Solver testSolver = new Solver(_seed + 1000);
                
                int solutions = testSolver.CountSolutions(testCube, 2);

                if (solutions == 1)
                {
                    removed++;
                }
                else
                {
                    // this cell can't be removed - put it back
                    cell.setNumber(originalValue);
                }
            }

            clueCount = 54 - removed;
            return puzzleCube;
        }
    }
}

