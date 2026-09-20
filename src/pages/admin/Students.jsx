import {
  Ban,
  CheckCircle2,
  CreditCard,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

const initialStudents = [
  {
    id: 1,
    studentNumber: "2026-0001",
    name: "Juan Dela Cruz",
    cardUid: "04:A3:7B:91",
    balance: 250.5,
    status: "Active",
  },
  {
    id: 2,
    studentNumber: "2026-0002",
    name: "Maria Santos",
    cardUid: "83:B7:21:4C",
    balance: 120,
    status: "Active",
  },
  {
    id: 3,
    studentNumber: "2026-0003",
    name: "Carlo Reyes",
    cardUid: "12:6F:9A:D2",
    balance: 75.25,
    status: "Active",
  },
  {
    id: 4,
    studentNumber: "2026-0004",
    name: "Angela Cruz",
    cardUid: "7D:42:AC:18",
    balance: 0,
    status: "Blocked",
  },
];

const initialFormData = {
  studentNumber: "",
  name: "",
  cardUid: "",
  balance: "",
  status: "Active",
};

export default function Students() {
  const [students, setStudents] = useState(initialStudents);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showStudentModal, setShowStudentModal] =
    useState(false);

  const [editingStudent, setEditingStudent] =
    useState(null);

  const [formData, setFormData] =
    useState(initialFormData);

  const [formError, setFormError] = useState("");

  const [openMenuId, setOpenMenuId] = useState(null);

  const filteredStudents = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchValue) ||
        student.studentNumber
          .toLowerCase()
          .includes(searchValue) ||
        student.cardUid
          .toLowerCase()
          .includes(searchValue);

      const matchesStatus =
        statusFilter === "All" ||
        student.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [students, search, statusFilter]);

  const activeStudents = students.filter(
    (student) => student.status === "Active"
  ).length;

  const blockedStudents = students.filter(
    (student) => student.status === "Blocked"
  ).length;

  const totalBalance = students.reduce(
    (total, student) => total + student.balance,
    0
  );

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setFormData(initialFormData);
    setFormError("");
    setShowStudentModal(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);

    setFormData({
      studentNumber: student.studentNumber,
      name: student.name,
      cardUid: student.cardUid,
      balance: String(student.balance),
      status: student.status,
    });

    setFormError("");
    setOpenMenuId(null);
    setShowStudentModal(true);
  };

  const closeStudentModal = () => {
    setShowStudentModal(false);
    setEditingStudent(null);
    setFormData(initialFormData);
    setFormError("");
  };

  const handleSubmitStudent = (event) => {
    event.preventDefault();
    setFormError("");

    const studentNumber =
      formData.studentNumber.trim();

    const name = formData.name.trim();

    const cardUid = formData.cardUid
      .trim()
      .toUpperCase();

    const balance =
      formData.balance === ""
        ? 0
        : Number(formData.balance);

    if (!studentNumber || !name || !cardUid) {
      setFormError(
        "Student number, student name, and card UID are required."
      );
      return;
    }

    if (
      Number.isNaN(balance) ||
      balance < 0
    ) {
      setFormError(
        "Please enter a valid balance."
      );
      return;
    }

    const duplicateStudentNumber =
      students.some(
        (student) =>
          student.studentNumber.toLowerCase() ===
            studentNumber.toLowerCase() &&
          student.id !== editingStudent?.id
      );

    if (duplicateStudentNumber) {
      setFormError(
        "This student number is already registered."
      );
      return;
    }

    const duplicateCardUid =
      students.some(
        (student) =>
          student.cardUid.toLowerCase() ===
            cardUid.toLowerCase() &&
          student.id !== editingStudent?.id
      );

    if (duplicateCardUid) {
      setFormError(
        "This card UID is already assigned to another student."
      );
      return;
    }

    if (editingStudent) {
      setStudents((current) =>
        current.map((student) =>
          student.id === editingStudent.id
            ? {
                ...student,
                studentNumber,
                name,
                cardUid,
                balance,
                status: formData.status,
              }
            : student
        )
      );
    } else {
      const newStudent = {
        id:
          students.length > 0
            ? Math.max(
                ...students.map(
                  (student) => student.id
                )
              ) + 1
            : 1,

        studentNumber,
        name,
        cardUid,
        balance,
        status: formData.status,
      };

      setStudents((current) => [
        ...current,
        newStudent,
      ]);
    }

    closeStudentModal();
  };

  const toggleStudentStatus = (student) => {
    const newStatus =
      student.status === "Active"
        ? "Blocked"
        : "Active";

    setStudents((current) =>
      current.map((currentStudent) =>
        currentStudent.id === student.id
          ? {
              ...currentStudent,
              status: newStatus,
            }
          : currentStudent
      )
    );

    setOpenMenuId(null);
  };

  return (
    <div>
      {/* Page Heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Students
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage registered students and their vending
            machine ID cards.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Student
        </button>
      </div>

      {/* Statistics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StudentStatCard
          title="Registered Students"
          value={students.length}
          description="Students with registered IDs"
          icon={Users}
        />

        <StudentStatCard
          title="Active Cards"
          value={activeStudents}
          description="Cards allowed for payment"
          icon={CheckCircle2}
        />

        <StudentStatCard
          title="Blocked Cards"
          value={blockedStudents}
          description="Cards currently disabled"
          icon={Ban}
        />

        <StudentStatCard
          title="Total Balance"
          value={`₱${totalBalance.toFixed(2)}`}
          description="Combined simulated balance"
          icon={WalletCards}
        />
      </div>

      {/* Student Table */}
      <div className="mt-6 overflow-visible rounded-2xl border border-slate-200 bg-white">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search student, number, or card UID..."
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal
              size={18}
              className="text-slate-400"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="All">
                All statuses
              </option>

              <option value="Active">
                Active
              </option>

              <option value="Blocked">
                Blocked
              </option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">
                  Student
                </th>

                <th className="px-6 py-3 font-medium">
                  Student Number
                </th>

                <th className="px-6 py-3 font-medium">
                  Card UID
                </th>

                <th className="px-6 py-3 font-medium">
                  Balance
                </th>

                <th className="px-6 py-3 font-medium">
                  Status
                </th>

                <th className="px-6 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => (
                <tr
                  key={student.id}
                  className="transition hover:bg-slate-50"
                >
                  {/* Student */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <UserRound size={18} />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {student.name}
                        </p>

                        <p className="text-xs text-slate-400">
                          Student #{student.id}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Student Number */}
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">
                    {student.studentNumber}
                  </td>

                  {/* Card UID */}
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <CreditCard
                        size={15}
                        className="text-slate-400"
                      />

                      <span className="font-mono text-xs text-slate-600">
                        {student.cardUid}
                      </span>
                    </div>
                  </td>

                  {/* Balance */}
                  <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                    ₱{student.balance.toFixed(2)}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <StudentStatusBadge
                      status={student.status}
                    />
                  </td>

                  {/* Actions */}
                  <td className="relative px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuId((current) =>
                          current === student.id
                            ? null
                            : student.id
                        )
                      }
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Actions for ${student.name}`}
                    >
                      <MoreHorizontal size={19} />
                    </button>

                    {openMenuId === student.id && (
                      <div className="absolute right-6 top-12 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg">
                        <button
                          type="button"
                          onClick={() =>
                            openEditModal(student)
                          }
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleStudentStatus(
                              student
                            )
                          }
                          className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm transition ${
                            student.status ===
                            "Active"
                              ? "text-red-600 hover:bg-red-50"
                              : "text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {student.status ===
                          "Active" ? (
                            <>
                              <Ban size={16} />
                              Block Card
                            </>
                          ) : (
                            <>
                              <CheckCircle2
                                size={16}
                              />
                              Activate Card
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStudents.length === 0 && (
            <div className="px-6 py-14 text-center">
              <Users
                size={34}
                className="mx-auto text-slate-300"
              />

              <p className="mt-3 font-medium text-slate-700">
                No students found
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Try changing your search or status
                filter.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">
            Showing {filteredStudents.length} of{" "}
            {students.length} students
          </p>
        </div>
      </div>

      {/* Add / Edit Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingStudent
                    ? "Edit Student"
                    : "Add Student"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editingStudent
                    ? "Update the student and card information."
                    : "Register a student ID for vending machine payments."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeStudentModal}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitStudent}>
              <div className="space-y-5 p-6">
                {/* Student Number */}
                <div>
                  <label
                    htmlFor="student-number"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Student number
                  </label>

                  <input
                    id="student-number"
                    name="studentNumber"
                    type="text"
                    value={
                      formData.studentNumber
                    }
                    onChange={handleInputChange}
                    placeholder="e.g. 2026-0001"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {/* Student Name */}
                <div>
                  <label
                    htmlFor="student-name"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Student name
                  </label>

                  <input
                    id="student-name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {/* Card UID */}
                <div>
                  <label
                    htmlFor="card-uid"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Card UID
                  </label>

                  <input
                    id="card-uid"
                    name="cardUid"
                    type="text"
                    value={formData.cardUid}
                    onChange={handleInputChange}
                    placeholder="e.g. 04:A3:7B:91"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 font-mono text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    This will later be captured
                    automatically from the physical
                    student ID card reader.
                  </p>
                </div>

                {/* Starting Balance */}
                <div>
                  <label
                    htmlFor="student-balance"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Starting balance
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      ₱
                    </span>

                    <input
                      id="student-balance"
                      name="balance"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.balance}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-300 py-2.5 pl-8 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label
                    htmlFor="student-status"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Card status
                  </label>

                  <select
                    id="student-status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="Active">
                      Active
                    </option>

                    <option value="Blocked">
                      Blocked
                    </option>
                  </select>
                </div>

                {/* Error */}
                {formError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {formError}
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeStudentModal}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  {editingStudent
                    ? "Save Changes"
                    : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentStatCard({
  title,
  value,
  description,
  icon: Icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function StudentStatusBadge({ status }) {
  if (status === "Active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 size={13} />
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      <Ban size={13} />
      Blocked
    </span>
  );
}