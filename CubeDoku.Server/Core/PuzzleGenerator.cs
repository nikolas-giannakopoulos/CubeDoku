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

        // Δημιουργεί puzzle με εγγυημένα μοναδική λύση
        public Cube GenerateUniquePuzzle(out int clueCount)
        {
            Console.WriteLine($"🎲 Generating puzzle with seed: {_seed}");
            
            // 1. Δημιούργησε λυμένο κύβο
            Cube solvedCube = new Cube();
            Solver solver = new Solver(_seed);
            
            if (!solver.run(solvedCube))
            {
                throw new Exception("Failed to generate solved cube!");
            }
            
            Console.WriteLine($"✅ Generated solved cube in {solver.Iterations:N0} iterations");

            // 2. Clone τον κύβο για το puzzle
            Cube puzzleCube = CloneCube(solvedCube);

            // 3. Συλλέγουμε όλα τα κελιά που μπορούμε να κρύψουμε
            List<Cell> cellsToRemove = GetAllCells(puzzleCube);
            
            // 4. Shuffle τη σειρά με την οποία θα δοκιμάσουμε να κρύψουμε κελιά
            ShuffleCells(cellsToRemove);

            int removed = 0;
            int attempts = 0;

            Console.WriteLine($"🔍 Starting to remove clues...");

            // 5. Προσπάθησε να κρύψεις κελιά ένα-ένα
            foreach (var cell in cellsToRemove)
            {
                attempts++;
                int originalValue = cell.getNumber();
                
                // Κρύψε το κελί
                cell.setNumber(0);

                // Έλεγξε αν έχει ακόμα μοναδική λύση
                Cube testCube = CloneCube(puzzleCube);
                Solver testSolver = new Solver(_seed + 1000); // Διαφορετικό seed για testing
                
                int solutions = testSolver.CountSolutions(testCube, 2);

                if (solutions == 1)
                {
                    // Καλό! Το κελί μπορεί να μείνει κρυμμένο
                    removed++;
                    if (removed % 5 == 0)
                    {
                        Console.WriteLine($"  ✓ Removed {removed} clues so far... ({attempts} attempts)");
                    }
                }
                else
                {
                    // Όχι καλό, επαναφορά
                    cell.setNumber(originalValue);
                }
            }

            clueCount = 54 - removed;
            Console.WriteLine($"🎯 Final puzzle has {clueCount} clues ({removed} removed)");
            
            return puzzleCube;
        }

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

        /// <summary>
        /// Δημιουργεί puzzle που λύνεται με λογική (no guessing) και έχει συγκεκριμένο difficulty
        /// </summary>
        /// <summary>
        /// Δημιουργεί puzzle που λύνεται με λογική (no guessing) και έχει συγκεκριμένο difficulty
        /// </summary>
        public (Cube Puzzle, List<LogicalStep> Steps) GeneratePuzzle(Difficulty targetDifficulty, int maxAttempts = 50)
        {
            Console.WriteLine($"🎯 Generating {targetDifficulty} puzzle (max {maxAttempts} attempts)...");

            Cube bestPuzzle = null;
            int bestClueCount = 54;
            SolvabilityResult bestResult = null;
            // Fallback: any solvable puzzle (even if difficulty doesn't match target)
            Cube fallbackPuzzle = null;
            int fallbackClueCount = 54;
            SolvabilityResult fallbackResult = null;
            
            // Set target clues based on difficulty
            // Classic: ~25 clues (Easier)
            // BrainTerror: As few as possible (Hard)
            int targetClues = targetDifficulty == Difficulty.Classic ? 25 : 0;

            for (int attempt = 1; attempt <= maxAttempts; attempt++)
            {
                // Χρησιμοποίησε διαφορετικό internal seed για κάθε attempt
                int attemptSeed = _seed + attempt * 1000;
                var tempGenerator = new PuzzleGenerator(attemptSeed);

                // Δημιούργησε unique puzzle με στρατηγική αφαίρεση
                var puzzle = tempGenerator.GenerateUniquePuzzleStrategic(targetClues, out int tempClues);

                // Έλεγξε αν λύνεται λογικά
                var testCube = CloneCube(puzzle);
                var logicalSolver = new LogicalSolver(testCube);
                var result = logicalSolver.Solve();

                // Keep any solvable puzzle as fallback
                if (result.IsSolvable && fallbackPuzzle == null)
                {
                    fallbackPuzzle = puzzle;
                    fallbackClueCount = tempClues;
                    fallbackResult = result;
                }

                if (result.IsSolvable && result.Difficulty <= targetDifficulty)
                {
                    // Βρήκαμε καλό puzzle!
                    if (attempt % 5 == 0 || result.Difficulty == targetDifficulty)
                    {
                        Console.WriteLine($"  Attempt {attempt}: {result.Difficulty} with {tempClues} clues");
                    }

                    // Κράτα το καλύτερο (με λιγότερα clues στο target difficulty)
                    // For classic, we want to be close to target, not necessarily lowest
                    bool isBetter = false;
                    
                    if (targetDifficulty == Difficulty.Classic)
                    {
                         // For Classic, we modify the selection logic:
                         // Any solvable puzzle at Classic difficulty is good if we hit our target (which strategic generation handles)
                         // But if we have multiple, maybe closer to 25 is better? 
                         // Strategic generation stops AT 25, so tempClues will be >= 25.
                         // We prefer the one with fewer clues that is still >= 25 (closest to target) 
                         // actually GenerateUniquePuzzleStrategic stops when <= targetClues. 
                         
                         if (bestPuzzle == null) isBetter = true;
                         else if (Math.Abs(tempClues - targetClues) < Math.Abs(bestClueCount - targetClues)) isBetter = true;
                    }
                    else
                    {
                        // Standard behavior for Hard: Fewer clues is better
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
                // Fallback: use the best solvable puzzle even if difficulty doesn't match
                if (fallbackPuzzle != null)
                {
                    Console.WriteLine($"⚠️ No exact {targetDifficulty} puzzle found. Using fallback ({fallbackResult!.Difficulty}) with {fallbackClueCount} clues.");
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

            Console.WriteLine($"✅ Generated {bestResult.Difficulty} puzzle with {bestClueCount} clues");
            Console.WriteLine($"   Steps required: {bestResult.StepsRequired}");
            foreach (var tech in bestResult.TechniquesUsed ?? new Dictionary<string, int>())
            {
                Console.WriteLine($"   - {tech.Key}: {tech.Value} times");
            }

            // Print the logical solving steps for the final puzzle
            Console.WriteLine("\n🧩 Logical Solving Steps for the Generated Puzzle:");
            var finalTestCube = CloneCube(bestPuzzle);
            var stepLogger = new LogicalSolver(finalTestCube, debug: true);
            stepLogger.Solve();
            Console.WriteLine("--------------------------------------------------\n");

            return (bestPuzzle, stepLogger.Result?.Steps ?? new List<LogicalStep>());
        }

        /// <summary>
        /// Στρατηγική αφαίρεση: Centers → Edges → Corners
        /// </summary>
        private Cube GenerateUniquePuzzleStrategic(int targetClues, out int clueCount)
        {
            // 1. Δημιούργησε λυμένο κύβο
            Cube solvedCube = new Cube();
            Solver solver = new Solver(_seed);
            
            if (!solver.run(solvedCube))
            {
                throw new Exception("Failed to generate solved cube!");
            }

            // 2. Clone
            Cube puzzleCube = CloneCube(solvedCube);

            // 3. Συλλέξε κελιά ανά τύπο
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

            // 4. Shuffle και δοκίμασε αφαίρεση στη σειρά: Centers → Edges → Corners
            ShuffleCells(centers);
            ShuffleCells(edges);
            ShuffleCells(corners);

            var orderedCells = new List<Cell>();
            orderedCells.AddRange(centers);
            orderedCells.AddRange(edges);
            orderedCells.AddRange(corners);

            int removed = 0;
            // 54 total cells
            foreach (var cell in orderedCells)
            {
                // Check if we reached target clues
                if (targetClues > 0 && (54 - removed) <= targetClues)
                {
                    break;
                }

                int originalValue = cell.getNumber();
                cell.setNumber(0);

                Cube testCube = CloneCube(puzzleCube);
                Solver testSolver = new Solver(_seed + 1000);
                
                int solutions = testSolver.CountSolutions(testCube, 2);

                if (solutions == 1)
                {
                    removed++;
                }
                else
                {
                    cell.setNumber(originalValue);
                }
            }

            clueCount = 54 - removed;
            return puzzleCube;
        }
    }
}
