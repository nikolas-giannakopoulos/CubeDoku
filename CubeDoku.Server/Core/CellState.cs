// visual state of a cell - used for highlighting errors and completion animations
// probably could have called this CellColor or something, but CellState is what made sense to me
// Default = no issues, Error = constraint violated, Completed = all constraints for this cell met

namespace CubeDoku.Server.Core
{
    public enum CellState 
    {
        Default,
        Error,
        Completed
    }
}