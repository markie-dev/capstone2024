'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { initializeFirebase, db as getFirebaseDb } from '../authcontext';

const SearchPage = () => {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('query');

  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedInsurance, setSelectedInsurance] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // temp filter states for display purposes 
  const [tempInsurance, setTempInsurance] = useState('');
  const [tempCity, setTempCity] = useState('');

  const insuranceOptions = ["Aetna", "BlueCross", "Cigna", "UnitedHealthcare", "Humana", "Molina Healthcare", "Health Net", "Other Asian Insurances"];
  const cityOptions = ["Denton", "Dallas", "Lewisville"];

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError('');

    try {

      await initializeFirebase(); // err if removed idk why 

      const db = getFirebaseDb();

      const doctorsRef = collection(db, 'users');

      // fetch all doctors first
      let q = query(doctorsRef, where('role', '==', 'doctor'));

      // optional filters
      if (selectedInsurance) {
        q = query(q, where("acceptedInsurances", "array-contains", selectedInsurance));
      }
      if (selectedCity) {
        q = query(q, where("city", "==", selectedCity));
      }

      const querySnapshot = await getDocs(q);
      let doctorData = querySnapshot.docs.map(doc => doc.data());

      // filter based on query
      doctorData = doctorData.filter(doctor => 
        (doctor.firstName?.toLowerCase().includes(searchQuery?.toLowerCase() ?? '')) ||
        (doctor.lastName?.toLowerCase().includes(searchQuery?.toLowerCase() ?? '')) ||
        (doctor.acceptedInsurances?.some((ins: string) => ins.toLowerCase().includes(searchQuery?.toLowerCase() ?? ''))) ||
        (doctor.city?.toLowerCase().includes(searchQuery?.toLowerCase() ?? '')) ||
        (doctor.clinicName?.toLowerCase().includes(searchQuery?.toLowerCase() ?? '')) ||
        (doctor.degree?.toLowerCase().includes(searchQuery?.toLowerCase() ?? '')) ||
        (doctor.specialty?.toLowerCase().includes(searchQuery?.toLowerCase() ?? '')) ||
        (doctor.spokenLanguages?.some((lang: string) => lang.toLowerCase().includes(searchQuery?.toLowerCase() ?? ''))) ||
        (doctor.state?.toLowerCase().includes(searchQuery?.toLowerCase() ?? '')) ||
        (doctor.streetAddress?.toLowerCase().includes(searchQuery?.toLowerCase() ?? '')) ||
        (doctor.zipCode?.toLowerCase().includes(searchQuery?.toLowerCase() ?? ''))
      );

      setDoctors(doctorData);
    } catch (err) {
      setError('Error fetching doctors.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedInsurance, selectedCity]);

  // search doctors based on query only, filters can be selected after
  useEffect(() => {
    if (searchQuery) {
      fetchDoctors();
    }
  }, [searchQuery, fetchDoctors]);

  const handleSearchClick: () => void = () => {
    setSelectedInsurance(tempInsurance);
    //setTempInsurance('');
    setSelectedCity(tempCity);
    //setTempCity('');
    fetchDoctors();
  };

  return (
    <div>
      <div className="bg-white shadow-md p-4 mb-6 rounded-md">
        <h3 className="text-lg font-semibold mb-2">Search For Doctors</h3>
        
        <div className="flex gap-4">
          <select
            className="border p-2 rounded-md w-1/4"
            value={tempInsurance}
            onChange={(e) => setTempInsurance(e.target.value)}
          >
            <option value="">Choose Insurance</option>
            {insuranceOptions.map((insurance, index) => (
              <option key={index} value={insurance}>{insurance}</option>
            ))}
          </select>

          <select
            className="border p-2 rounded-md w-1/4"
            value={tempCity}
            onChange={(e) => setTempCity(e.target.value)}
          >
            <option value="">Choose City</option>
            {cityOptions.map((city, index) => (
              <option key={index} value={city}>{city}</option>
            ))}
          </select>

          <button
            className="bg-blue-500 text-white px-4 py-2 rounded-md w-1/4"
            onClick={handleSearchClick}
          >
            Search
          </button>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      {doctors.length === 0 && !loading && <p>No doctors found.</p>}

      <ul>
        {doctors.map((doctor, index) => (
          <li key={index}>{doctor.firstName} {doctor.lastName}</li>
        ))}
      </ul>

    </div>
  );
};

export default SearchPage;
