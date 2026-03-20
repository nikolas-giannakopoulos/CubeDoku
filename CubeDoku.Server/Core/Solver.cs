namespace CubeDoku.Server.Core
{
    public class Solver{

        public long Iterations = 0;
        private Random _random;

        public Solver(int seed){
            _random = new Random(seed);
        }
        
        public bool run(Cube cube)
        {
            // Search for the bestCell
            Cell bestCell = GetBestCell(cube);

            // Base Case: If there is no empty cell, solved
            if (bestCell == null) return true;

            Iterations++;
            if (Iterations % 500000 == 0)
            {
                var pos = bestCell.getPosition();
                Console.WriteLine($"Iter: {Iterations:N0} | Smart-Solving: {pos.face} [{pos.row},{pos.column}]");
            }

            // Random number for different day
            int[] candidates = GetShuffledNumbers();

            foreach (int number in candidates)
            {
                bestCell.setNumber(number);

                // If valid
                if (Checkers.Checker(bestCell, cube))
                {
                    // Recursive
                    if (run(cube)) return true;
                }
            }

            // Backtracking
            bestCell.setNumber(0);
            return false;
        }

        private int[] GetShuffledNumbers()
        {
            int[] numbers = { 1, 2, 3, 4, 5, 6, 7, 8, 9 };
            // Fisher-Yates Shuffle
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

        // MRV Heuristic
        private Cell GetBestCell(Cube cube)
        {
            Cell bestCell = null;
            int minOptions = 100;

            foreach (var face in Enum.GetValues<CubeFaces>())
            {
                for (int row = 0; row < 3; row++)
                {
                    for (int column = 0; column < 3; column++)
                    {
                        var pos = new CellPosition(face, row, column);
                        var cell = cube.getCell(pos);

                        // If cell is filled, skip
                        if (cell.getNumber() != 0) continue;

                        // Check which number are allowed to set
                        int validOptionsForThisCell = CountValidMoves(cube, cell);

                        // If Cell exists with 0 options, select it to Fail Fast
                        if (validOptionsForThisCell == 0) return cell;

                        // Keep the cell with the least options
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

        private int CountValidMoves(Cube cube, Cell cell)
        {
            int count = 0;
            for (int n = 1; n <= 9; n++)
            {
                cell.setNumber(n);
                if (Checkers.Checker(cell, cube)) count++;
                cell.setNumber(0);
            }
            return count;
        }

        // Μετράει πόσες λύσεις υπάρχουν (σταματάει στο maxSolutions για ταχύτητα)
        public int CountSolutions(Cube cube, int maxSolutions = 2)
        {
            int solutionCount = 0;
            CountSolutionsRecursive(cube, ref solutionCount, maxSolutions);
            return solutionCount;
        }

        private bool CountSolutionsRecursive(Cube cube, ref int solutionCount, int maxSolutions)
        {
            // Αν βρήκαμε ήδη αρκετές λύσεις, σταματάμε
            if (solutionCount >= maxSolutions) return true;

            // Βρες το επόμενο κενό κελί με MRV
            Cell bestCell = GetBestCell(cube);

            // Αν δεν υπάρχει κενό κελί, βρήκαμε λύση
            if (bestCell == null)
            {
                solutionCount++;
                return solutionCount >= maxSolutions;
            }

            // Δοκιμάζουμε όλους τους αριθμούς (ΟΧI τυχαία σειρά για consistency)
            for (int number = 1; number <= 9; number++)
            {
                bestCell.setNumber(number);

                if (Checkers.Checker(bestCell, cube))
                {
                    // Συνεχίζουμε αναδρομικά
                    if (CountSolutionsRecursive(cube, ref solutionCount, maxSolutions))
                    {
                        bestCell.setNumber(0);
                        return true; // Βρήκαμε αρκετές λύσεις
                    }
                }
            }

            // Backtracking
            bestCell.setNumber(0);
            return false;
        }
    }
}