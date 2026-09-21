import {
  Ban,
  CheckCircle2,
  CreditCard,
  Loader2,
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
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const initialFormData = {
  studentNumber: "",
  name: "",
  cardUid: "",
  status: "active",
};

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showStudentModal, setShowStudentModal] =
    useState(false);

  const [editingStudent, setEditingStudent] =
    useState(null);

  const [formData, setFormData] =
    useState(initialFormData);

  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] =
    useState(null);

  // -------------------------
  // Load Students + Cards
  // -------------------------

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      setPageError("");

      const { data, error } = await supabase
        .from("students")
        .select(`
          id,
          student_number,
          full_name,
          balance,
          status,
          created_at,
          student_cards (
            id,
            card_uid,
            status,
            issued_at
          )
        `)
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Unable to load students:",
          error
        );

        setPageError(
          "Unable to load students. Please try again."
        );

        setLoading(false);
        return;
      }

      const formattedStudents = (data ?? []).map(
        (student) => {
          const cards = student.student_cards ?? [];

          const activeCard =
            cards.find(
              (card) => card.status === "active"
            ) ?? cards[0];

          return {
            id: student.id,
            studentNumber: student.student_number,
            name: student.full_name,
            balance: Number(student.balance),
            studentStatus: student.status,

            cardId: activeCard?.id ?? null,
            cardUid:
              activeCard?.card_uid ?? "No card assigned",
            cardStatus:
              activeCard?.status ?? "unassigned",
          };
        }
      );

      setStudents(formattedStudents);
      setLoading(false);
    };

    loadStudents();
  }, []);

  // -------------------------
  // Filtering
  // -------------------------

  const filteredStudents = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        student.name
          .toLowerCase()
          .includes(searchValue) ||
        student.studentNumber
          .toLowerCase()
          .includes(searchValue) ||
        student.cardUid
          .toLowerCase()
          .includes(searchValue);

      const displayStatus =
        student.cardStatus === "active"
          ? "Active"
          : student.cardStatus === "unassigned"
            ? "Unassigned"
            : "Blocked";

      const matchesStatus =
        statusFilter === "All" ||
        displayStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [students, search, statusFilter]);

  // -------------------------
  // Statistics
  // -------------------------

  const activeCards = students.filter(
    (student) => student.cardStatus === "active"
  ).length;

  const blockedCards = students.filter(
    (student) =>
      student.cardStatus === "blocked" ||
      student.cardStatus === "lost" ||
      student.cardStatus === "replaced"
  ).length;

  const totalBalance = students.reduce(
    (total, student) =>
      total + Number(student.balance),
    0
  );

  // -------------------------
  // Form Helpers
  // -------------------------

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
    setOpenMenuId(null);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);

    setFormData({
      studentNumber: student.studentNumber,
      name: student.name,
      cardUid:
        student.cardId !== null
          ? student.cardUid
          : "",
      status:
        student.cardStatus === "active"
          ? "active"
          : "blocked",
    });

    setFormError("");
    setOpenMenuId(null);
    setShowStudentModal(true);
  };

  const closeStudentModal = () => {
    if (saving) {
      return;
    }

    setShowStudentModal(false);
    setEditingStudent(null);
    setFormData(initialFormData);
    setFormError("");
  };

  // -------------------------
  // Add / Edit Student
  // -------------------------

  const handleSubmitStudent = async (event) => {
    event.preventDefault();

    setFormError("");

    const studentNumber =
      formData.studentNumber.trim();

    const name = formData.name.trim();

    const cardUid = formData.cardUid
      .trim()
      .toUpperCase();

    if (!studentNumber || !name || !cardUid) {
      setFormError(
        "Student number, student name, and card UID are required."
      );
      return;
    }

    setSaving(true);

    try {
      if (editingStudent) {
        // -------------------------
        // Update Student
        // -------------------------

        const { error: studentError } =
          await supabase
            .from("students")
            .update({
              student_number: studentNumber,
              full_name: name,
            })
            .eq("id", editingStudent.id);

        if (studentError) {
          if (studentError.code === "23505") {
            setFormError(
              "This student number is already registered."
            );
          } else {
            console.error(
              "Unable to update student:",
              studentError
            );

            setFormError(
              "Unable to update student. Please try again."
            );
          }

          setSaving(false);
          return;
        }

        // Existing card
        if (editingStudent.cardId) {
          const { error: cardError } =
            await supabase
              .from("student_cards")
              .update({
                card_uid: cardUid,
                status: formData.status,
              })
              .eq(
                "id",
                editingStudent.cardId
              );

          if (cardError) {
            if (cardError.code === "23505") {
              setFormError(
                "This card UID is already assigned to another student."
              );
            } else {
              console.error(
                "Unable to update card:",
                cardError
              );

              setFormError(
                "Student information was updated, but the card could not be updated."
              );
            }

            setSaving(false);
            return;
          }
        } else {
          // Student exists but has no card
          const { data: newCard, error: cardError } =
            await supabase
              .from("student_cards")
              .insert({
                student_id: editingStudent.id,
                card_uid: cardUid,
                status: formData.status,
              })
              .select(
                "id, card_uid, status"
              )
              .single();

          if (cardError) {
            if (cardError.code === "23505") {
              setFormError(
                "This card UID is already assigned to another student."
              );
            } else {
              console.error(
                "Unable to assign card:",
                cardError
              );

              setFormError(
                "Student information was updated, but the card could not be assigned."
              );
            }

            setSaving(false);
            return;
          }

          setStudents((current) =>
            current.map((student) =>
              student.id === editingStudent.id
                ? {
                    ...student,
                    studentNumber,
                    name,
                    cardId: newCard.id,
                    cardUid: newCard.card_uid,
                    cardStatus:
                      newCard.status,
                  }
                : student
            )
          );

          setSaving(false);
          setShowStudentModal(false);
          setEditingStudent(null);
          setFormData(initialFormData);
          setFormError("");
          return;
        }

        setStudents((current) =>
          current.map((student) =>
            student.id === editingStudent.id
              ? {
                  ...student,
                  studentNumber,
                  name,
                  cardUid,
                  cardStatus:
                    formData.status,
                }
              : student
          )
        );
      } else {
        // -------------------------
        // Create Student
        // -------------------------

        const {
          data: newStudent,
          error: studentError,
        } = await supabase
          .from("students")
          .insert({
            student_number: studentNumber,
            full_name: name,
            balance: 0,
            status: "active",
          })
          .select(
            "id, student_number, full_name, balance, status"
          )
          .single();

        if (studentError) {
          if (studentError.code === "23505") {
            setFormError(
              "This student number is already registered."
            );
          } else {
            console.error(
              "Unable to create student:",
              studentError
            );

            setFormError(
              "Unable to add student. Please try again."
            );
          }

          setSaving(false);
          return;
        }

        // Create student's card
        const {
          data: newCard,
          error: cardError,
        } = await supabase
          .from("student_cards")
          .insert({
            student_id: newStudent.id,
            card_uid: cardUid,
            status: formData.status,
          })
          .select("id, card_uid, status")
          .single();

        if (cardError) {
          // Roll back student if card creation fails.
          const { error: rollbackError } =
            await supabase
              .from("students")
              .delete()
              .eq("id", newStudent.id);

          if (rollbackError) {
            console.error(
              "Unable to roll back student:",
              rollbackError
            );
          }

          if (cardError.code === "23505") {
            setFormError(
              "This card UID is already assigned to another student."
            );
          } else {
            console.error(
              "Unable to create card:",
              cardError
            );

            setFormError(
              "Unable to register the student card. Please try again."
            );
          }

          setSaving(false);
          return;
        }

        const formattedStudent = {
          id: newStudent.id,
          studentNumber:
            newStudent.student_number,
          name: newStudent.full_name,
          balance: Number(newStudent.balance),
          studentStatus: newStudent.status,
          cardId: newCard.id,
          cardUid: newCard.card_uid,
          cardStatus: newCard.status,
        };

        setStudents((current) => [
          ...current,
          formattedStudent,
        ]);
      }

      setSaving(false);
      setShowStudentModal(false);
      setEditingStudent(null);
      setFormData(initialFormData);
      setFormError("");
    } catch (error) {
      console.error(
        "Unexpected student operation error:",
        error
      );

      setFormError(
        "Something went wrong. Please try again."
      );

      setSaving(false);
    }
  };

  // -------------------------
  // Block / Activate Card
  // -------------------------

  const toggleCardStatus = async (student) => {
    if (!student.cardId) {
      setOpenMenuId(null);
      return;
    }

    const newStatus =
      student.cardStatus === "active"
        ? "blocked"
        : "active";

    setUpdatingStatusId(student.id);
    setOpenMenuId(null);

    const { error } = await supabase
      .from("student_cards")
      .update({
        status: newStatus,
      })
      .eq("id", student.cardId);

    if (error) {
      console.error(
        "Unable to update card status:",
        error
      );

      setPageError(
        "Unable to update card status. Please try again."
      );

      setUpdatingStatusId(null);
      return;
    }

    setStudents((current) =>
      current.map((currentStudent) =>
        currentStudent.id === student.id
          ? {
              ...currentStudent,
              cardStatus: newStatus,
            }
          : currentStudent
      )
    );

    setUpdatingStatusId(null);
    setPageError("");
  };

  // -------------------------
  // Loading
  // -------------------------

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center">
          <Loader2
            size={30}
            className="mx-auto animate-spin text-blue-600"
          />

          <p className="mt-3 text-sm text-slate-500">
            Loading students...
          </p>
        </div>
      </div>
    );
  }

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

      {/* Page Error */}
      {pageError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {pageError}
        </div>
      )}

      {/* Statistics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StudentStatCard
          title="Registered Students"
          value={students.length}
          description="Students registered in the system"
          icon={Users}
        />

        <StudentStatCard
          title="Active Cards"
          value={activeCards}
          description="Cards allowed for payment"
          icon={CheckCircle2}
        />

        <StudentStatCard
          title="Blocked Cards"
          value={blockedCards}
          description="Cards currently disabled"
          icon={Ban}
        />

        <StudentStatCard
          title="Total Balance"
          value={`₱${totalBalance.toFixed(2)}`}
          description="Combined student balance"
          icon={WalletCards}
        />
      </div>

      {/* Student Table */}
      <div className="mt-6 overflow-visible rounded-2xl border border-slate-200 bg-white">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          {/* Search */}
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

          {/* Status Filter */}
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

              <option value="Unassigned">
                No Card
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
                  Card Status
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
                          ID{" "}
                          {student.id
                            .slice(0, 8)
                            .toUpperCase()}
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
                    {student.cardId ? (
                      <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                        <CreditCard
                          size={15}
                          className="text-slate-400"
                        />

                        <span className="font-mono text-xs text-slate-600">
                          {student.cardUid}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">
                        No card assigned
                      </span>
                    )}
                  </td>

                  {/* Balance */}
                  <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                    ₱
                    {Number(
                      student.balance
                    ).toFixed(2)}
                  </td>

                  {/* Card Status */}
                  <td className="px-6 py-4">
                    <StudentStatusBadge
                      status={student.cardStatus}
                    />
                  </td>

                  {/* Actions */}
                  <td className="relative px-6 py-4 text-right">
                    {updatingStatusId ===
                    student.id ? (
                      <div className="inline-flex p-2">
                        <Loader2
                          size={19}
                          className="animate-spin text-blue-600"
                        />
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId(
                              (current) =>
                                current ===
                                student.id
                                  ? null
                                  : student.id
                            )
                          }
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Actions for ${student.name}`}
                        >
                          <MoreHorizontal
                            size={19}
                          />
                        </button>

                        {openMenuId ===
                          student.id && (
                          <div className="absolute right-6 top-12 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg">
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  student
                                )
                              }
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil
                                size={16}
                              />
                              Edit
                            </button>

                            {student.cardId && (
                              <button
                                type="button"
                                onClick={() =>
                                  toggleCardStatus(
                                    student
                                  )
                                }
                                className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm transition ${
                                  student.cardStatus ===
                                  "active"
                                    ? "text-red-600 hover:bg-red-50"
                                    : "text-green-700 hover:bg-green-50"
                                }`}
                              >
                                {student.cardStatus ===
                                "active" ? (
                                  <>
                                    <Ban
                                      size={16}
                                    />
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
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty Results */}
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
                    ? "Update student and card information."
                    : "Register a student and their vending machine card."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeStudentModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
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
                    disabled={saving}
                    placeholder="e.g. 2026-0001"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
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
                    disabled={saving}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
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
                    disabled={saving}
                    placeholder="e.g. 04:A3:7B:91"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 font-mono text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                  />

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    This is the electronic UID read
                    from the physical student card.
                    It is separate from the printed
                    student number.
                  </p>
                </div>

                {/* Card Status */}
                <div>
                  <label
                    htmlFor="card-status"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Card status
                  </label>

                  <select
                    id="card-status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    disabled={saving}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="blocked">
                      Blocked
                    </option>
                  </select>
                </div>

                {/* Balance Information */}
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-sm font-medium text-blue-800">
                    {editingStudent
                      ? `Current balance: ₱${Number(
                          editingStudent.balance
                        ).toFixed(2)}`
                      : "Starting balance: ₱0.00"}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-blue-600">
                    Balance is not edited here.
                    Balance changes will be recorded
                    through top-up, purchase, refund,
                    or adjustment transactions.
                  </p>
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
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : editingStudent
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
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 size={13} />
        Active
      </span>
    );
  }

  if (status === "unassigned") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        <CreditCard size={13} />
        No Card
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