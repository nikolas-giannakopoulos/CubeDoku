const res = await fetch("http://localhost:5053/api/Game/move", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
        Face: "Front",
        Row: 0,
        Column: 0,
        Value: 9,
        CurrentState: Array(54).fill().map((_,i) => i===0 ? 5 : 0),
        LockedState: Array(54).fill(false)
    })
});
const text = await res.text();
console.log(res.status, text);
