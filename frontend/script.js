// Bug fixed: backend mounts routes at /api/students (see backend/app.js),
// but this used to point at /students with no /api prefix and the wrong
// port, which is exactly why "Server connection failed" was showing up.
const API_URL = "http://localhost:5000/api/students";

const studentForm = document.getElementById("studentForm");
const studentList = document.getElementById("studentList");

// GET - All Students
async function getStudents() {
    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        // Bug fixed: the backend now returns { data, page, total, ... } for
        // pagination instead of a bare array. Reading result.data keeps this
        // working either way (falls back to the raw array for safety).
        const students = Array.isArray(result) ? result : result.data || [];

        if (!studentList) return students;

        studentList.innerHTML = "";

        students.forEach(student => {
            const div = document.createElement("div");

            div.className = "student";

            div.innerHTML = `
                <h3>${student.name}</h3>
                <p>Email: ${student.email}</p>
                <p>Age: ${student.age}</p>
                <p>Course: ${student.course}</p>

                <button onclick="updateStudent('${student._id}')">
                    Update
                </button>

                <button onclick="deleteStudent('${student._id}')">
                    Delete
                </button>
            `;

            studentList.appendChild(div);
        });

        return students;

    } catch (error) {
        console.log("Error:", error);
        return [];
    }
}


// POST - Add Student
if (studentForm) {
    studentForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const studentData = {
            name: document.getElementById("name").value,
            email: document.getElementById("email").value,
            age: Number(document.getElementById("age").value),
            course: document.getElementById("course").value,
        };

        try {

            const response = await fetch(API_URL, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(studentData)
            });

            const data = await response.json();

            console.log(data);

            if (response.ok) {
                alert("Student added successfully!");

                studentForm.reset();

                getStudents();
            } else {
                alert(data.message);
            }

        } catch (error) {
            console.log("Error:", error);
            alert("Server connection failed");
        }
    });
}


// DELETE - Delete Student
async function deleteStudent(id) {

    try {

        const response = await fetch(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        const data = await response.json();

        console.log(data);

        if (response.ok) {
            alert("Student deleted successfully!");
            getStudents();
        } else {
            alert(data.message);
        }

        return data;

    } catch (error) {
        console.log("Error:", error);
    }
}


// PUT - Update Student
async function updateStudent(id, newCourseOverride) {

    const newCourse = newCourseOverride !== undefined ? newCourseOverride : prompt("Enter new course:");

    if (!newCourse) {
        return;
    }

    try {

        const response = await fetch(`${API_URL}/${id}`, {
            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                course: newCourse
            })
        });

        const data = await response.json();

        console.log(data);

        if (response.ok) {
            alert("Student updated successfully!");
            getStudents();
        } else {
            alert(data.message);
        }

        return data;

    } catch (error) {
        console.log("Error:", error);
    }
}


// Load students when page opens (only in a real browser with the list present)
if (studentList) {
    getStudents();
}

// Testability: expose functions to Jest via CommonJS without changing
// browser behavior (module is undefined in a plain <script> tag).
if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStudents, deleteStudent, updateStudent, API_URL };
}
