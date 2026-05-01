// Solver.cs
// Backtracking solver with MRV (Minimum Remaining Values) heuristic
// This is used in two places:
//   1. Generating a solved cube from scratch (called by PuzzleGenerator)
//   2. Counting solutions - to verify a puzzle has a UNIQUE solution
//
// The MRV heuristic means we always pick the cell with the fewest valid options to try next
// This dramatically reduces the search space compared to just going left-to-right
// I learned about MRV from the constraint satisfaction problem literature - the slides from
// my AI course last year actually had exactly this algorithm
//
// For randomized generation we shuffle the numbers 1-9 before trying them (Fisher-Yates)
// so we get a different solution each time based on the seed. For uniqueness checking
// we go in order 1-9 for consistency.

namespace CubeDoku.Server.Core
{
    public class Solver{

        // public so the generator can print how many iterations it took - useful for debugging
        public long Iterations = 0;
        private Random _random;

        public Solver(int seed){
            _random = new Random(seed);
        }
        
        // main solve method - recursive backtracking with MRV
        // returns true if a solution was found, false if no solution exists
        public bool run(Cube cube)
        {
            // find the empty cell with the most constraints (fewest options)
            Cell bestCell = GetBestCell(cube);

            // base case: no empty cells left means we found a complete valid solution
            if (bestCell == null) return true;

            Iterations++;
            // occasional progress logging - useful to see if something is taking forever
            if (Iterations % 500000 == 0)
            {
                var pos = bestCell.getPosition();
                Console.WriteLine($"Iter: {Iterations:N0} | Smart-Solving: {pos.face} [{pos.row},{pos.column}]");
            }

            // try numbers in a random order so different seeds produce different puzzles
            int[] candidates = GetShuffledNumbers();

            foreach (int number in candidates)
            {
                bestCell.setNumber(number);

                if (Checkers.Checker(bestCell, cube))
                {
                    // valid so far - recurse
                    if (run(cube)) return true;
                }
            }

            // none of the numbers worked - backtrack
            bestCell.setNumber(0);
            return false;
        }

        // Fisher-Yates shuffle of 1-9 for randomized solving
        private int[] GetShuffledNumbers()
        {
            int[] numbers = { 1, 2, 3, 4, 5, 6, 7, 8, 9 };
            int n = numbers.Length;
            while (n > 1)
            {
                n--;
                int k = _random.Next(n + 1);
                int value = numbers[k];
                numbers[k] = numbers[n];
                numbers[n] = value;
            }
            return numbers;
        }

        // MRV heuristic: pick the empty cell with the fewest valid options
        // if a cell has 0 options we pick it immediately to trigger fast failure (fail-first)
        // this is the key optimization - without it, the solver is way too slow for the puzzle generator
        private Cell GetBestCell(Cube cube)
        {
            Cell bestCell = null;
            int minOptions = 100; // start high - any real count will be less than this

            foreach (var face in Enum.GetValues<CubeFaces>())
            {
                for (int row = 0; row < 3; row++)
                {
                    for (int column = 0; column < 3; column++)
                    {
                        var pos = new CellPosition(face, row, column);
                        var cell = cube.getCell(pos);

                        if (cell.getNumber() != 0) continue; // skip filled cells

                        int validOptionsForThisCell = CountValidMoves(cube, cell);

                        // 0 options = dead end - pick this immediately to fail fast
                        if (validOptionsForThisCell == 0) return cell;

                        if (validOptionsForThisCell < minOptions)
                        {
                            minOptions = validOptionsForThisCell;
                            bestCell = cell;
                        }
                    }
                }
            }
            return bestCell;
        }

        // count how many of 1-9 are valid placements in this cell
        // used by MRV to rank cells
        private int CountValidMoves(Cube cube, Cell cell)
        {
            int count = 0;
            for (int n = 1; n <= 9; n++)
            {
                cell.setNumber(n);
                if (Checkers.Checker(cell, cube)) count++;
                cell.setNumber(0); // reset after each test
            }
            return count;
        }

        // count how many solutions the current cube state has
        // used to verify uniqueness during puzzle generation
        // stops at maxSolutions (default 2) because we only care if there's 1 or >1
        // if there are 2+ solutions, the puzzle isn't valid (multiple answers are bad)
        public int CountSolutions(Cube cube, int maxSolutions = 2)
        {
            int solutionCount = 0;
            CountSolutionsRecursive(cube, ref solutionCount, maxSolutions);
            return solutionCount;
        }

        private bool CountSolutionsRecursive(Cube cube, ref int solutionCount, int maxSolutions)
        {
            // stop early if we've already found enough solutions
            if (solutionCount >= maxSolutions) return true;

            Cell bestCell = GetBestCell(cube);

            if (bestCell == null)
            {
                // no empty cells = another complete solution found
                solutionCount++;
                return solutionCount >= maxSolutions;
            }

            // try in order 1-9 (not shuffled) for consistency - we want deterministic counting
            for (int number = 1; number <= 9; number++)
            {
                bestCell.setNumber(number);

                if (Checkers.Checker(bestCell, cube))
                {
                    if (CountSolutionsRecursive(cube, ref solutionCount, maxSolutions))
                    {
                        bestCell.setNumber(0);
                        return true;
                    }
                }
            }

            // backtrack
            bestCell.setNumber(0);
            return false;
        }
    }
}